import { config } from '../config/index.js';
import { getAppName } from '../services/settings/resolvedConfig.js';

/**
 * Account Created notification.
 * Mirrors app/Notifications/AccountCreated.php
 *
 * Sends an email to the user when their account is created.
 * If a password reset token is provided, includes a setup link.
 */
export async function sendAccountCreatedNotification(
    user: { email: string; username: string; name_first: string | null; name_last?: string | null },
    token: string | null = null,
): Promise<void> {
    const appName = getAppName();
    const appUrl = config.app.url || 'http://localhost';

    const name = (user.name_first ?? '') + (user.name_last ? ` ${user.name_last}` : '');

    const subject = `Account Created on ${appName}`;
    let _body = `Hello ${name}!\n\n`;
    _body += `You are receiving this email because an account has been created for you on ${appName}.\n\n`;
    _body += `Username: ${user.username}\n`;
    _body += `Email: ${user.email}\n`;

    if (token) {
        const resetUrl = `${appUrl}/auth/password/reset/${token}?email=${encodeURIComponent(user.email)}`;
        _body += `\nSetup Your Account: ${resetUrl}\n`;
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
