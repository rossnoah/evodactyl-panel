import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { getAppName, getMailConfig } from '../services/settings/resolvedConfig.js';

let cachedTransporter: nodemailer.Transporter | null = null;

function buildTransporter(): nodemailer.Transporter {
    const mail = getMailConfig();
    return nodemailer.createTransport({
        host: mail.host,
        port: mail.port,
        secure: mail.encryption === 'ssl',
        auth: mail.username
            ? {
                  user: mail.username,
                  pass: mail.password,
              }
            : undefined,
    });
}

function getTransporter(): nodemailer.Transporter {
    if (!cachedTransporter) {
        cachedTransporter = buildTransporter();
    }
    return cachedTransporter;
}

/**
 * Drop the cached transporter so the next send rebuilds it from the
 * current resolved mail config. Call after the admin updates SMTP settings.
 */
export function invalidateTransporter(): void {
    cachedTransporter = null;
}

export interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

/**
 * Send an email notification.
 * Replaces Laravel's notification queue.
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
    try {
        const transport = getTransporter();
        const mail = getMailConfig();
        await transport.sendMail({
            from: `"${mail.fromName}" <${mail.fromAddress}>`,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
        });
    } catch (err) {
        console.error(`[Mail] Failed to send email to ${options.to}:`, err);
    }
}

/**
 * Send a test email to verify the current SMTP configuration. Unlike
 * `sendEmail`, this re-throws on failure so the admin gets a real error.
 */
export async function sendTestEmail(to: string): Promise<void> {
    const transport = getTransporter();
    const mail = getMailConfig();
    const appName = getAppName();
    await transport.sendMail({
        from: `"${mail.fromName}" <${mail.fromAddress}>`,
        to,
        subject: `${appName} Test Message`,
        text: `Hello!\n\nThis is a test of the ${appName} mail system. You're good to go!`,
        html: `<p>Hello!</p><p>This is a test of the <strong>${appName}</strong> mail system. You're good to go!</p>`,
    });
}

/**
 * Send a password reset email.
 */
export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${config.app.url}/auth/password/reset/${token}`;
    const appName = getAppName();
    await sendEmail({
        to: email,
        subject: `[${appName}] Password Reset`,
        html: `
      <p>You are receiving this email because we received a password reset request for your account.</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p>If you did not request a password reset, no further action is required.</p>
    `,
        text: `Reset your password: ${resetUrl}`,
    });
}

/**
 * Send an account created email.
 */
export async function sendAccountCreatedEmail(email: string, username: string, setupUrl?: string): Promise<void> {
    const appName = getAppName();
    await sendEmail({
        to: email,
        subject: `[${appName}] Account Created`,
        html: `
      <p>An account has been created for you on ${appName}.</p>
      <p>Username: <strong>${username}</strong></p>
      ${setupUrl ? `<p><a href="${setupUrl}">Set up your account</a></p>` : ''}
    `,
    });
}

/**
 * Send a notification when a user is added to a server.
 */
export async function sendAddedToServerEmail(email: string, serverName: string): Promise<void> {
    const appName = getAppName();
    await sendEmail({
        to: email,
        subject: `[${appName}] Added to Server`,
        html: `<p>You have been added as a subuser to the server <strong>${serverName}</strong>.</p>`,
    });
}

/**
 * Send a notification when a user is removed from a server.
 */
export async function sendRemovedFromServerEmail(email: string, serverName: string): Promise<void> {
    const appName = getAppName();
    await sendEmail({
        to: email,
        subject: `[${appName}] Removed from Server`,
        html: `<p>You have been removed as a subuser from the server <strong>${serverName}</strong>.</p>`,
    });
}

/**
 * Send server installed notification.
 */
export async function sendServerInstalledEmail(email: string, serverName: string): Promise<void> {
    if (!config.pterodactyl.email.sendInstallNotification) return;
    const appName = getAppName();
    await sendEmail({
        to: email,
        subject: `[${appName}] Server Installed`,
        html: `<p>Your server <strong>${serverName}</strong> has finished installing and is now ready to use.</p>`,
    });
}
