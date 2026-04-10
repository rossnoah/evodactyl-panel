import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../../prisma/client.js';
import { hashPassword } from '../../lib/password.js';
import { DisplayException, ValidationException } from '../../errors/index.js';

/**
 * Auth Reset Password Controller.
 * Mirrors app/Http/Controllers/Auth/ResetPasswordController.php
 */

/**
 * POST /auth/password/reset
 * Reset a user's password using a reset token.
 */
export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, email, password, password_confirmation } = req.body;

    // Validate input
    const errors: Array<{ sourceField: string; rule: string; detail: string }> = [];
    if (!token) errors.push({ sourceField: 'token', rule: 'required', detail: 'The token field is required.' });
    if (!email) errors.push({ sourceField: 'email', rule: 'required', detail: 'The email field is required.' });
    if (!password) errors.push({ sourceField: 'password', rule: 'required', detail: 'The password field is required.' });
    if (!password_confirmation) errors.push({ sourceField: 'password_confirmation', rule: 'required', detail: 'The password confirmation field is required.' });

    if (errors.length > 0) {
      throw new ValidationException(errors);
    }

    if (password !== password_confirmation) {
      throw new ValidationException([
        { sourceField: 'password', rule: 'confirmed', detail: 'The password confirmation does not match.' },
      ]);
    }

    if (password.length < 8) {
      throw new ValidationException([
        { sourceField: 'password', rule: 'min', detail: 'The password must be at least 8 characters.' },
      ]);
    }

    // Hash the token for comparison
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find the reset record
    const resetRecord = await prisma.password_resets.findFirst({
      where: {
        email: email.toLowerCase(),
        token: hashedToken,
      },
    });

    if (!resetRecord) {
      throw new DisplayException('This password reset token is invalid.', 400);
    }

    // Check if token is expired (60 minutes)
    const createdAt = resetRecord.created_at ? new Date(resetRecord.created_at).getTime() : 0;
    if (Date.now() - createdAt > 60 * 60 * 1000) {
      // Clean up expired token
      await prisma.password_resets.deleteMany({
        where: { email: email.toLowerCase() },
      });

      throw new DisplayException('This password reset token is invalid.', 400);
    }

    // Find the user
    const user = await prisma.users.findFirst({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new DisplayException('This password reset token is invalid.', 400);
    }

    // Update the password
    const hashedPassword = await hashPassword(password);
    const rememberToken = crypto.randomBytes(30).toString('hex');

    await prisma.users.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        remember_token: rememberToken,
        updated_at: new Date(),
      },
    });

    // Delete the reset token
    await prisma.password_resets.deleteMany({
      where: { email: email.toLowerCase() },
    });

    // If user doesn't have 2FA, we could log them in via session
    const hasTwoFactor = Boolean(user.use_totp);

    if (!hasTwoFactor && req.session) {
      (req.session as any).userId = user.id;
    }

    res.json({
      success: true,
      redirect_to: '/',
      send_to_login: hasTwoFactor,
    });
  } catch (err) {
    next(err);
  }
}
