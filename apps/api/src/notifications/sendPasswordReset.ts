import { config } from '../config/index.js';

/**
 * Send Password Reset notification.
 * Mirrors app/Notifications/SendPasswordReset.php
 *
 * Sends an email containing a password reset link.
 */
export async function sendPasswordResetNotification(
  user: { email: string },
  token: string
): Promise<void> {
  const appUrl = config.app.url || 'http://localhost';
  const resetUrl = `${appUrl}/auth/password/reset/${token}?email=${encodeURIComponent(user.email)}`;

  const subject = 'Reset Password';
  let body = 'You are receiving this email because we received a password reset request for your account.\n\n';
  body += `Reset Password: ${resetUrl}\n\n`;
  body += 'If you did not request a password reset, no further action is required.\n';

  // In a production implementation, this would use a mail transport (nodemailer, etc.)
  console.log(`[Notification] PasswordReset email to ${user.email}: ${subject}`);

  // TODO: Wire up actual email sending via nodemailer or similar
  // await sendMail({
  //   to: user.email,
  //   subject,
  //   text: body,
  // });
}
