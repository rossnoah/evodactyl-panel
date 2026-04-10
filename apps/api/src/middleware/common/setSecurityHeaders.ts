import type { NextFunction, Request, Response } from '@/types/express.js';

/**
 * Set security headers on all responses.
 * Mirrors app/Http/Middleware/Api/SetSecurityHeaders.php (if exists)
 * and common security best practices.
 */
export function setSecurityHeaders(_req: Request, res: Response, next: NextFunction): void {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
}
