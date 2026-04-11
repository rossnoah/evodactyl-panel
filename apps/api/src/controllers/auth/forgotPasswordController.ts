import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from '@/types/express.js';
import { DisplayException } from '../../errors/index.js';
import { sendPasswordResetNotification } from '../../notifications/sendPasswordReset.js';
import { prisma } from '../../prisma/client.js';
import { verifyRecaptcha } from '../../services/auth/recaptchaService.js';

/**
 * Auth Forgot Password Controller.
 * Mirrors app/Http/Controllers/Auth/ForgotPasswordController.php
 *
 * IMPORTANT: Always returns success to avoid leaking whether an account exists.
 */

/**
 * POST /auth/password
 * Send a password reset link email.
 */
export async function sendResetLinkEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const captchaOk = await verifyRecaptcha(req.body?.['g-recaptcha-response'], req.ip);
        if (!captchaOk) {
            throw new DisplayException('Captcha verification failed. Please try again.', 422);
        }

        const email = req.body?.email;

        if (!email || typeof email !== 'string') {
            // Still return success to avoid enumeration
            res.json({ status: 'We have e-mailed your password reset link!' });
            return;
        }

        // Attempt to find the user
        const user = await prisma.users.findFirst({
            where: { email: email.toLowerCase() },
        });

        if (user) {
            // Generate a reset token
            const token = crypto.randomBytes(32).toString('hex');
            const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

            // Delete any existing reset tokens for this email
            await prisma.password_resets.deleteMany({
                where: { email: user.email },
            });

            // Create the new token
            await prisma.password_resets.create({
                data: {
                    email: user.email,
                    token: hashedToken,
                    created_at: new Date(),
                },
            });

            // Send the notification (fire-and-forget)
            sendPasswordResetNotification(user, token).catch(() => {
                // Notification failures should not break the flow
            });
        }

        // Always return success to prevent account enumeration
        res.json({ status: 'We have e-mailed your password reset link!' });
    } catch (err) {
        next(err);
    }
}
