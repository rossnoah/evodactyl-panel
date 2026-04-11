import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from '@/types/express.js';
import { DisplayException } from '../../errors/index.js';
import { verifyPassword } from '../../lib/password.js';
import { prisma } from '../../prisma/client.js';
import { activityFromRequest } from '../../services/activity/activityLogService.js';
import { verifyRecaptcha } from '../../services/auth/recaptchaService.js';

declare module 'express-session' {
    interface SessionData {
        userId?: number;
        twoFactorToken?: string;
        twoFactorTokenExpiry?: number;
        csrfToken?: string;
    }
}

/**
 * Auth Login Controller.
 * Mirrors app/Http/Controllers/Auth/LoginController.php
 * and app/Http/Controllers/Auth/AbstractLoginController.php
 */

// Simple in-memory login attempt tracker
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 120; // seconds

/**
 * Determine if the login field is an email or username.
 */
function getField(input: string | undefined): string {
    return input?.includes('@') ? 'email' : 'username';
}

/**
 * Get the throttle key for a request.
 */
function throttleKey(req: Request): string {
    const user = req.body?.user || '';
    const ip = req.ip || '';
    return `${user.toLowerCase()}|${ip}`;
}

/**
 * Check if too many login attempts.
 */
function hasTooManyAttempts(req: Request): boolean {
    const key = throttleKey(req);
    const entry = loginAttempts.get(key);
    if (!entry) return false;

    const now = Math.floor(Date.now() / 1000);
    if (entry.lockedUntil > now) return true;

    // Reset if lockout expired
    if (entry.count >= MAX_LOGIN_ATTEMPTS && entry.lockedUntil <= now) {
        loginAttempts.delete(key);
        return false;
    }

    return false;
}

/**
 * Increment login attempts.
 */
function incrementAttempts(req: Request): void {
    const key = throttleKey(req);
    const entry = loginAttempts.get(key);
    const now = Math.floor(Date.now() / 1000);

    if (entry) {
        entry.count++;
        if (entry.count >= MAX_LOGIN_ATTEMPTS) {
            entry.lockedUntil = now + LOCKOUT_TIME;
        }
    } else {
        loginAttempts.set(key, { count: 1, lockedUntil: 0 });
    }
}

/**
 * Clear login attempts.
 */
function clearAttempts(req: Request): void {
    loginAttempts.delete(throttleKey(req));
}

/**
 * POST /auth/login
 * Handle a login request.
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        if (hasTooManyAttempts(req)) {
            throw new DisplayException('Too many login attempts. Please try again later.', 429);
        }

        const captchaOk = await verifyRecaptcha(req.body?.['g-recaptcha-response'], req.ip);
        if (!captchaOk) {
            incrementAttempts(req);
            throw new DisplayException('Captcha verification failed. Please try again.', 422);
        }

        const username = req.body?.user;
        const password = req.body?.password;

        if (!username || !password) {
            throw new DisplayException('These credentials do not match our records.', 401);
        }

        const field = getField(username);

        const user = await prisma.users.findFirst({
            where: { [field]: username },
        });

        if (!user) {
            incrementAttempts(req);
            throw new DisplayException('These credentials do not match our records.', 401);
        }

        // Verify password
        if (!(await verifyPassword(password, user.password))) {
            incrementAttempts(req);
            throw new DisplayException('These credentials do not match our records.', 401);
        }

        // If user does not have 2FA enabled, complete login
        if (!user.use_totp) {
            clearAttempts(req);

            // Regenerate session and set user ID
            await new Promise<void>((resolve, reject) => {
                req.session.regenerate((err) => {
                    if (err) return reject(err);
                    req.session.userId = user.id;
                    resolve();
                });
            });

            res.json({
                data: {
                    complete: true,
                    intended: '/',
                    user: {
                        uuid: user.uuid,
                        username: user.username,
                        email: user.email,
                        name_first: user.name_first,
                        name_last: user.name_last,
                        root_admin: Boolean(user.root_admin),
                        use_totp: Boolean(user.use_totp),
                        gravatar: Boolean(user.gravatar),
                        language: user.language,
                        updated_at: user.updated_at?.toISOString().replace(/\.\d{3}Z$/, '+00:00') ?? null,
                        created_at: user.created_at?.toISOString().replace(/\.\d{3}Z$/, '+00:00') ?? null,
                    },
                },
            });
            return;
        }

        // User has 2FA enabled, create a checkpoint token
        await activityFromRequest(req).event('auth:checkpoint').actor(user).log();

        const token = crypto.randomBytes(32).toString('hex');
        if (req.session) {
            (req.session as any).auth_confirmation_token = {
                user_id: user.id,
                token_value: token,
                expires_at: Date.now() + 5 * 60 * 1000, // 5 minutes
            };
        }

        res.json({
            data: {
                complete: false,
                confirmation_token: token,
            },
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /auth/logout
 * Handle a logout request.
 */
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        await new Promise<void>((resolve, reject) => {
            req.session.destroy((err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        res.status(204).send();
    } catch (err) {
        next(err);
    }
}
