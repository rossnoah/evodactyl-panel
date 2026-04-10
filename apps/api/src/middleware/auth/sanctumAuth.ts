import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../../prisma/client.js';
import { decrypt } from '../../lib/encryption.js';
import { AuthenticationException } from '../../errors/index.js';

/**
 * Sanctum-compatible bearer token authentication.
 *
 * Laravel Sanctum stores API keys in the `api_keys` table with:
 * - `identifier`: first 16 chars of the token (used for lookup)
 * - `token`: encrypted remaining portion (used for verification)
 *
 * The bearer token format is: <identifier><plain_token>
 * The identifier is a fixed 16 chars, and the token portion varies.
 */
export async function sanctumAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  // First try Bearer token auth
  const authHeader = req.headers.authorization;

  // If no Bearer token, try session-based auth (for SPA requests with cookies)
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const sessionUserId = (req.session as any)?.userId;
    if (sessionUserId) {
      try {
        const user = await prisma.users.findUnique({ where: { id: sessionUserId } });
        if (user) {
          (req as any).user = user;
          (req as any).apiKey = null;
          return next();
        }
      } catch {}
    }
    return next(new AuthenticationException());
  }

  const bearer = authHeader.slice(7);
  if (bearer.length < 17) {
    return next(new AuthenticationException());
  }

  // The identifier is the first 16 characters
  const identifier = bearer.substring(0, 16);
  const plainToken = bearer.substring(16);

  try {
    // Look up the API key by identifier
    const apiKey = await prisma.api_keys.findFirst({
      where: { identifier },
    });

    if (!apiKey) {
      return next(new AuthenticationException());
    }

    // Check expiration
    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      return next(new AuthenticationException());
    }

    // Decrypt the stored token and compare
    const storedToken = decrypt(apiKey.token);
    if (!crypto.timingSafeEqual(
      Buffer.from(storedToken),
      Buffer.from(plainToken)
    )) {
      return next(new AuthenticationException());
    }

    // Load the associated user
    const user = await prisma.users.findUnique({
      where: { id: apiKey.user_id },
    });

    if (!user) {
      return next(new AuthenticationException());
    }

    // Update last_used_at
    await prisma.api_keys.update({
      where: { id: apiKey.id },
      data: { last_used_at: new Date() },
    });

    // Attach to request
    (req as any).user = user;
    (req as any).apiKey = apiKey;

    next();
  } catch (err) {
    next(new AuthenticationException());
  }
}
