import type { NextFunction, Request, Response } from '@/types/express.js';
import { config } from '../../../config/index.js';
import { decrypt } from '../../../lib/encryption.js';
import { prisma } from '../../../prisma/client.js';

/**
 * Returns the Wings daemon configuration for a node.
 * Mirrors app/Http/Controllers/Api/Application/Nodes/NodeConfigurationController.php
 * and app/Models/Node::getConfiguration()
 *
 * GET /api/application/nodes/:id/configuration
 */
export const getConfiguration = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const nodeId = parseInt(req.params.id, 10);
        const node = await prisma.nodes.findUnique({
            where: { id: nodeId },
        });

        if (!node) {
            res.status(404).json({ error: 'Node not found.' });
            return;
        }

        // Decrypt the daemon token
        let token: string;
        try {
            token = decrypt(node.daemon_token);
        } catch {
            token = '';
        }

        // Build the configuration object matching Node::getConfiguration()
        const configuration = {
            debug: false,
            uuid: node.uuid,
            token_id: node.daemon_token_id,
            token,
            api: {
                host: '0.0.0.0',
                port: node.daemonListen,
                ssl: {
                    enabled: !node.behind_proxy && node.scheme === 'https',
                    cert: `/etc/letsencrypt/live/${node.fqdn.toLowerCase()}/fullchain.pem`,
                    key: `/etc/letsencrypt/live/${node.fqdn.toLowerCase()}/privkey.pem`,
                },
                upload_limit: node.upload_size,
            },
            system: {
                data: node.daemonBase,
                sftp: {
                    bind_port: node.daemonSFTP,
                },
            },
            allowed_mounts: [] as string[],
            remote: config.app.url,
        };

        res.json(configuration);
    } catch (err) {
        next(err);
    }
};
