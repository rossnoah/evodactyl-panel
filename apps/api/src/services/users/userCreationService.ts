import { prisma } from '../../prisma/client.js';
import { generateUuid } from '../../lib/uuid.js';
import { hashPassword } from '../../lib/password.js';
import { sendAccountCreatedNotification } from '../../notifications/accountCreated.js';
import crypto from 'node:crypto';

/**
 * Service for creating new users.
 * Mirrors app/Services/Users/UserCreationService.php
 */
export async function createUser(data: {
  external_id?: string | null;
  email: string;
  username: string;
  name_first: string;
  name_last: string;
  password?: string;
  language?: string;
  root_admin?: boolean;
}): Promise<any> {
  let hashedPassword: string;
  let generateResetToken = false;

  if (data.password && data.password.length > 0) {
    hashedPassword = await hashPassword(data.password);
  } else {
    generateResetToken = true;
    hashedPassword = await hashPassword(crypto.randomBytes(30).toString('hex'));
  }

  const user = await prisma.users.create({
    data: {
      uuid: generateUuid(),
      external_id: data.external_id ?? null,
      email: data.email,
      username: data.username,
      name_first: data.name_first,
      name_last: data.name_last,
      password: hashedPassword,
      language: data.language ?? 'en',
      root_admin: data.root_admin ? 1 : 0,
      use_totp: 0,
    },
  });

  let resetToken: string | null = null;
  if (generateResetToken) {
    // Create a password reset token
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    await prisma.password_resets.create({
      data: {
        email: user.email,
        token: hashedToken,
        created_at: new Date(),
      },
    });

    resetToken = token;
  }

  // Send account created notification
  sendAccountCreatedNotification(user, resetToken).catch(() => {
    // Notification failures should not break user creation
  });

  return user;
}
