import type { NextFunction, Request, Response } from '@/types/express.js';
import { config } from '../../config/index.js';
import { AccessDeniedHttpException } from '../../errors/index.js';

/**
 * Require two-factor authentication if the panel is configured to enforce it.
 * Mirrors app/Http/Middleware/RequireTwoFactorAuthentication.php
 *
 * Levels:
 * 0 = Not required
 * 1 = Required for admins only
 * 2 = Required for all users
 */
export function requireTwoFactor(req: Request, _res: Response, next: NextFunction): void {
    const user = (req as any).user;
    if (!user) {
        return next();
    }

    const level = config.pterodactyl.auth.twoFactorRequired;

    // 2FA not required
    if (level === 0) {
        return next();
    }

    // User already has 2FA enabled
    if (user.use_totp) {
        return next();
    }

    // Level 1: Only required for admins
    if (level === 1 && !user.root_admin) {
        return next();
    }

    // Level 2: Required for everyone (or level 1 and user is admin)
    next(
        new AccessDeniedHttpException(
            'You must enable two-factor authentication on your account in order to access this endpoint.',
        ),
    );
}
