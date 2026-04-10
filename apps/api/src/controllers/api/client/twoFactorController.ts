import type { NextFunction, Request, Response } from '@/types/express.js';
import { BadRequestHttpException, ValidationException } from '../../../errors/index.js';
import { verifyPassword } from '../../../lib/password.js';
import { prisma } from '../../../prisma/client.js';
import { activityFromRequest } from '../../../services/activity/activityLogService.js';
import { toggleTwoFactor } from '../../../services/users/toggleTwoFactorService.js';
import { setupTwoFactor } from '../../../services/users/twoFactorSetupService.js';

/**
 * Client API Two-Factor Controller.
 * Mirrors app/Http/Controllers/Api/Client/TwoFactorController.php
 */

/**
 * GET /api/client/account/two-factor
 * Returns two-factor token credentials that allow a user to configure
 * it on their account. Returns a 400 if 2FA is already enabled.
 */
export async function index(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const user = (req as any).user;

        if (user.use_totp) {
            throw new BadRequestHttpException('Two-factor authentication is already enabled on this account.');
        }

        const data = await setupTwoFactor(user);

        res.json({ data });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/client/account/two-factor
 * Enable two-factor authentication on the user's account.
 */
export async function store(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const user = (req as any).user;
        const { code, password } = req.body;

        // Validate input
        if (!code || typeof code !== 'string' || code.length !== 6) {
            throw new ValidationException([
                { sourceField: 'code', rule: 'size', detail: 'The code must be exactly 6 characters.' },
            ]);
        }

        if (!password || typeof password !== 'string') {
            throw new ValidationException([
                { sourceField: 'password', rule: 'required', detail: 'The password field is required.' },
            ]);
        }

        // Verify the user's password
        if (!(await verifyPassword(password, user.password))) {
            throw new BadRequestHttpException('The password provided was not valid.');
        }

        const tokens = await toggleTwoFactor(user, code, true);

        await activityFromRequest(req).event('user:two-factor.create').log();

        res.json({
            object: 'recovery_tokens',
            attributes: {
                tokens,
            },
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/client/account/two-factor/disable
 * Disable two-factor authentication on the user's account.
 */
export async function destroy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const user = (req as any).user;
        const password = req.body?.password ?? '';

        // Verify the user's password
        if (!(await verifyPassword(password, user.password))) {
            throw new BadRequestHttpException('The password provided was not valid.');
        }

        await prisma.users.update({
            where: { id: user.id },
            data: {
                totp_authenticated_at: new Date(),
                use_totp: false,
            },
        });

        await activityFromRequest(req).event('user:two-factor.delete').log();

        res.status(204).send();
    } catch (err) {
        next(err);
    }
}
