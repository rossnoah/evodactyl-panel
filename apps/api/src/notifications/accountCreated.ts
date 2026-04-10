import { config } from '../config/index.js';

/**
 * Account Created notification.
 * Mirrors app/Notifications/AccountCreated.php
 *
 * Sends an email to the user when their account is created.
 * If a password reset token is provided, includes a setup link.
 */
export async function sendAccountCreatedNotification(
  user: { email: string; username: string; name_first: string; name_last?: string },
  token: string | null = null
): Promise<void> {
  const appName = config.app.name || 'Pterodactyl';
  const appUrl = config.app.url || 'http://localhost';

  const name = user.name_first + (user.name_last ? ` ${user.name_last}` : '');

  let subject = `Account Created on ${appName}`;
  let body = `Hello ${name}!\n\n`;
  body += `You are receiving this email because an account has been created for you on ${appName}.\n\n`;
  body += `Username: ${user.username}\n`;
  body += `Email: ${user.email}\n`;

  if (token) {
    const resetUrl = `${appUrl}/auth/password/reset/${token}?email=${encodeURIComponent(user.email)}`;
    body += `\nSetup Your Account: ${resetUrl}\n`;
  }

  // In a production implementation, this would use a mail transport (nodemailer, etc.)
  // For now, we log the notification intent and the mail service will be wired up
  // as part of the infrastructure layer.
  console.log(`[Notification] AccountCreated email to ${user.email}: ${subject}`);

  // TODO: Wire up actual email sending via nodemailer or similar
  // await sendMail({
  //   to: user.email,
  //   subject,
  //   text: body,
  // });
}
