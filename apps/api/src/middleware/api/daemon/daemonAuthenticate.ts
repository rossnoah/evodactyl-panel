import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from '@/types/express.js';
import { AccessDeniedHttpException, AuthenticationException, BadRequestHttpException } from '../../../errors/index.js';
import { decrypt } from '../../../lib/encryption.js';
import { prisma } from '../../../prisma/client.js';

/**
 * Daemon authentication middleware.
 * Mirrors app/Http/Middleware/Api/Daemon/DaemonAuthenticate.php
 *
 * Validates the daemon bearer token format: <daemon_token_id>.<plain_token>
 * Looks up the node by daemon_token_id, decrypts the stored daemon_token,
 * and compares using constant-time comparison.
 */
export async function daemonAuthenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return next(new AuthenticationException('Access to this endpoint must include an Authorization header.'));
    }

    const bearer = authHeader.slice(7);
    const parts = bearer.split('.');

    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return next(new BadRequestHttpException('The Authorization header provided was not in a valid format.'));
    }

    const [tokenId, plainToken] = parts;

    try {
        const node = await prisma.nodes.findFirst({
            where: { daemon_token_id: tokenId },
        });

        if (!node) {
            return next(new AccessDeniedHttpException('You are not authorized to access this resource.'));
        }

        const storedToken = decrypt(node.daemon_token);

        if (crypto.timingSafeEqual(Buffer.from(storedToken), Buffer.from(plainToken))) {
            (req as any).node = node;
            return next();
        }
    } catch {
        // Silently fail — don't expose node existence
    }

    next(new AccessDeniedHttpException('You are not authorized to access this resource.'));
}
