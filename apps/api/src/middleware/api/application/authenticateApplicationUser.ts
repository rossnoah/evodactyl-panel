import { Request, Response, NextFunction } from 'express';
import { AccessDeniedHttpException } from '../../../errors/index.js';

/**
 * Ensure the authenticated user is an admin and the API key is an application-type key.
 * Mirrors app/Http/Middleware/Api/Application/AuthenticateApplicationUser.php
 *
 * API key types:
 * - 1 (TYPE_ACCOUNT): Personal access token — user must be root_admin
 * - 2 (TYPE_APPLICATION): Application key — always admin access
 */
export function authenticateApplicationUser(req: Request, _res: Response, next: NextFunction): void {
  const user = (req as any).user;
  const apiKey = (req as any).apiKey;

  if (!user) {
    return next(new AccessDeniedHttpException());
  }

  // Session-based auth (SPA) — user must be root_admin
  if (!apiKey) {
    if (user.root_admin) {
      return next();
    }
    return next(new AccessDeniedHttpException('This account does not have permission to access this resource.'));
  }

  const keyType = apiKey.key_type;

  // Application keys (type 2) are always admin
  if (keyType === 2) {
    return next();
  }

  // Account keys (type 1) require root_admin
  if (keyType === 1 && user.root_admin) {
    return next();
  }

  next(new AccessDeniedHttpException('This account does not have permission to access this resource.'));
}
