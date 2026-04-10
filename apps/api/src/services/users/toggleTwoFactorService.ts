import { prisma } from '../../prisma/client.js';
import { decrypt } from '../../lib/encryption.js';
import { hashPassword } from '../../lib/password.js';
import { config } from '../../config/index.js';
import { authenticator } from 'otplib';
import crypto from 'node:crypto';

/**
 * Service for toggling two-factor authentication on a user account.
 * Mirrors app/Services/Users/ToggleTwoFactorService.php
 */
export async function toggleTwoFactor(
  user: any,
  token: string,
  toggleState?: boolean
): Promise<string[]> {
  const secret = decrypt(user.totp_secret);

  // Verify the TOTP token
  authenticator.options = {
    window: config.pterodactyl.auth.twoFactor.window,
  };

  const isValid = authenticator.verify({ token, secret });

  if (!isValid) {
    throw new TwoFactorAuthenticationTokenInvalid();
  }

  // Determine the new state
  const newState = toggleState !== undefined ? toggleState : !user.use_totp;
  const tokens: string[] = [];

  // If we're enabling 2FA, generate recovery tokens
  if ((toggleState === undefined && !user.use_totp) || toggleState === true) {
    // Delete existing recovery tokens
    await prisma.recovery_tokens.deleteMany({
      where: { user_id: user.id },
    });

    // Generate 10 recovery tokens
    const inserts: Array<{ user_id: number; token: string; created_at: Date }> = [];

    for (let i = 0; i < 10; i++) {
      const plainToken = crypto.randomBytes(5).toString('hex'); // 10 chars hex
      const hashedToken = await hashPassword(plainToken);

      inserts.push({
        user_id: user.id,
        token: hashedToken,
        created_at: new Date(),
      });

      tokens.push(plainToken);
    }

    await prisma.recovery_tokens.createMany({ data: inserts });
  }

  // Update the user's 2FA state
  await prisma.users.update({
    where: { id: user.id },
    data: {
      totp_authenticated_at: null,
      use_totp: newState,
    },
  });

  return tokens;
}

/**
 * Exception thrown when the provided 2FA token is invalid.
 */
export class TwoFactorAuthenticationTokenInvalid extends Error {
  public statusCode = 400;

  constructor(message: string = 'The token provided is not valid.') {
    super(message);
    this.name = 'TwoFactorAuthenticationTokenInvalid';
  }
}
