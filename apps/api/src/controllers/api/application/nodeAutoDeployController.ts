import type { NextFunction, Request, Response } from '@/types/express.js';
import { decrypt } from '../../../lib/encryption.js';
import { prisma } from '../../../prisma/client.js';
import { createApiKey, KEY_TYPE_APPLICATION } from '../../../services/api/keyCreationService.js';

/**
 * Generates a deployment token for auto-configuring Wings on a node.
 * POST /api/application/nodes/:id/deploy-token
 *
 * Mirrors app/Http/Controllers/Admin/NodeAutoDeployController.php
 */
export const generateDeployToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const nodeId = parseInt(req.params.id as string, 10);

        const node = await prisma.nodes.findUnique({ where: { id: nodeId } });
        if (!node) {
            res.status(404).json({ error: 'Node not found.' });
            return;
        }

        // Get the authenticated user's ID from session or API key
        const userId = (req as any).user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required.' });
            return;
        }

        // Look for an existing application API key with node read permission
        const existingKey = await prisma.api_keys.findFirst({
            where: {
                user_id: userId,
                key_type: KEY_TYPE_APPLICATION,
                r_nodes: 1,
            },
        });

        let token: string;

        if (existingKey) {
            // Reconstruct the full token from identifier + decrypted token
            token = existingKey.identifier + decrypt(existingKey.token);
        } else {
            // Create a new API key with only node read permission
            const result = await createApiKey(
                {
                    user_id: userId,
                    memo: 'Automatically generated node deployment key.',
                    allowed_ips: [],
                },
                KEY_TYPE_APPLICATION,
                { r_nodes: 1 },
            );
            token = result.plainTextToken;
        }

        res.json({
            node: node.id,
            token,
        });
    } catch (err) {
        next(err);
    }
};
