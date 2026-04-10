import type { NextFunction, Request, Response } from '@/types/express.js';
import { AccessDeniedHttpException } from '../../errors/index.js';

/**
 * Check if the requesting IP is allowed by the API key's IP whitelist.
 * Mirrors app/Http/Middleware/Api/AuthenticateIPAccess.php
 */
export function authenticateIPAccess(req: Request, _res: Response, next: NextFunction): void {
    const apiKey = (req as any).apiKey;
    if (!apiKey) {
        return next();
    }

    // Parse allowed_ips — stored as JSON array string or null
    let allowedIps: string[] = [];
    if (apiKey.allowed_ips) {
        try {
            allowedIps = typeof apiKey.allowed_ips === 'string' ? JSON.parse(apiKey.allowed_ips) : apiKey.allowed_ips;
        } catch {
            allowedIps = [];
        }
    }

    // If no IPs are specified, allow all
    if (!Array.isArray(allowedIps) || allowedIps.length === 0) {
        return next();
    }

    const requestIp = req.ip ?? req.socket.remoteAddress ?? '';

    // Check if the request IP matches any allowed IP/CIDR
    const isAllowed = allowedIps.some((allowed) => {
        // Exact match
        if (allowed === requestIp) return true;

        // CIDR match (basic implementation)
        if (allowed.includes('/')) {
            return isIpInCidr(requestIp, allowed);
        }

        return false;
    });

    if (!isAllowed) {
        return next(new AccessDeniedHttpException('This IP address is not authorized to use this API key.'));
    }

    next();
}

function isIpInCidr(ip: string, cidr: string): boolean {
    const [range, bits] = cidr.split('/');
    const mask = parseInt(bits, 10);

    if (Number.isNaN(mask)) return false;

    const ipNum = ipToLong(ip);
    const rangeNum = ipToLong(range);
    const maskNum = ~((1 << (32 - mask)) - 1);

    return (ipNum & maskNum) === (rangeNum & maskNum);
}

function ipToLong(ip: string): number {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return 0;
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}
