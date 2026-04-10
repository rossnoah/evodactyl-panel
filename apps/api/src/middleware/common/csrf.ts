import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from '@/types/express.js';

/**
 * CSRF protection middleware matching Laravel Sanctum behavior.
 *
 * - On all requests: set XSRF-TOKEN cookie (unencrypted, readable by JS)
 * - On state-changing requests (POST/PUT/PATCH/DELETE):
 *   - If request has Authorization: Bearer header, skip CSRF (API key auth)
 *   - If request has session auth, validate X-XSRF-TOKEN header matches cookie
 *   - Skip for /api/remote/* (daemon routes use bearer token auth)
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
    // Generate/refresh XSRF token
    if (!req.session?.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }

    // Always set the XSRF-TOKEN cookie (readable by JavaScript, unlike the session cookie)
    res.cookie('XSRF-TOKEN', req.session.csrfToken, {
        httpOnly: false, // Must be readable by JS (axios reads it automatically)
        secure: req.secure,
        sameSite: 'lax',
        path: '/',
    });

    // Skip CSRF for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }

    // Skip for API key authenticated requests (Bearer token)
    if (req.headers.authorization?.startsWith('Bearer ')) {
        return next();
    }

    // Skip for daemon routes
    if (req.path.startsWith('/api/remote')) {
        return next();
    }

    // Skip for auth routes (login, password reset, etc. — no session exists yet)
    if (req.path.startsWith('/auth/')) {
        return next();
    }

    // Validate CSRF token for session-based state-changing requests
    const headerToken = req.headers['x-xsrf-token'] as string;
    if (!headerToken || headerToken !== req.session?.csrfToken) {
        res.status(419).json({
            errors: [
                {
                    code: 'TokenMismatchException',
                    status: '419',
                    detail: 'CSRF token mismatch.',
                },
            ],
        });
        return;
    }

    next();
}
