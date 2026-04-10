import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../prisma/client.js';
import { decrypt } from '../../lib/encryption.js';
import { verifyPassword } from '../../lib/password.js';
import { config } from '../../config/index.js';
import { DisplayException } from '../../errors/index.js';
import { authenticator } from 'otplib';
import crypto from 'node:crypto';

/**
 * Auth Login Checkpoint Controller.
 * Handles 2FA verification during login.
 * Mirrors app/Http/Controllers/Auth/LoginCheckpointController.php
 */

const TOKEN_EXPIRED_MESSAGE = 'The authentication token provided has expired, please refresh the page and try again.';

/**
 * POST /auth/login/checkpoint
 * Handle a login where the user must provide a 2FA token.
 */
export async function loginCheckpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Retrieve session data
    const details = req.session ? (req.session as any).auth_confirmation_token : null;

    if (!hasValidSessionData(details)) {
      throw new DisplayException(TOKEN_EXPIRED_MESSAGE, 401);
    }

    // Verify the confirmation token matches
    const confirmationToken = req.body?.confirmation_token ?? '';
    if (!crypto.timingSafeEqual(
      Buffer.from(confirmationToken),
      Buffer.from(details.token_value)
    )) {
      throw new DisplayException('These credentials do not match our records.', 401);
    }

    // Find the user
    const user = await prisma.users.findUnique({
      where: { id: details.user_id },
    });

    if (!user) {
      throw new DisplayException(TOKEN_EXPIRED_MESSAGE, 401);
    }

    // Check if a recovery token was provided
    const recoveryToken = req.body?.recovery_token;
    if (recoveryToken) {
      const isValidRecovery = await validateRecoveryToken(user, recoveryToken);

      if (isValidRecovery) {
        return sendLoginResponse(req, res, user);
      }

      throw new DisplayException('The recovery token provided is not valid.', 401);
    }

    // Verify TOTP token
    const authenticationCode = req.body?.authentication_code ?? '';

    const secret = decrypt(user.totp_secret!);

    authenticator.options = {
      window: config.pterodactyl.auth.twoFactor.window,
    };

    const isValid = authenticator.verify({ token: authenticationCode, secret });

    if (isValid) {
      await prisma.users.update({
        where: { id: user.id },
        data: { totp_authenticated_at: new Date() },
      });

      return sendLoginResponse(req, res, user);
    }

    throw new DisplayException('These credentials do not match our records.', 401);
  } catch (err) {
    next(err);
  }
}

/**
 * Validate a recovery token against the user's stored tokens.
 */
async function validateRecoveryToken(user: any, value: string): Promise<boolean> {
  const tokens = await prisma.recovery_tokens.findMany({
    where: { user_id: user.id },
  });

  for (const token of tokens) {
    if (await verifyPassword(value, token.token)) {
      await prisma.recovery_tokens.delete({
        where: { id: token.id },
      });
      return true;
    }
  }

  return false;
}

/**
 * Validate session data structure and expiration.
 */
function hasValidSessionData(data: any): boolean {
  if (!data) return false;
  if (!data.user_id || !data.token_value || !data.expires_at) return false;

  if (typeof data.expires_at === 'number' && data.expires_at < Date.now()) {
    return false;
  }

  return true;
}

/**
 * Send a successful login response.
 */
function sendLoginResponse(req: Request, res: Response, user: any): void {
  // Clear the confirmation token from the session
  if (req.session) {
    delete (req.session as any).auth_confirmation_token;
    (req.session as any).userId = user.id;
  }

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
        language: user.language,
        updated_at: user.updated_at?.toISOString().replace(/\.\d{3}Z$/, '+00:00') ?? null,
        created_at: user.created_at?.toISOString().replace(/\.\d{3}Z$/, '+00:00') ?? null,
      },
    },
  });
}
