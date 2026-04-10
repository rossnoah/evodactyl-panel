import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.encryption === 'ssl',
      auth: config.mail.username ? {
        user: config.mail.username,
        pass: config.mail.password,
      } : undefined,
    });
  }
  return transporter;
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
    await transport.sendMail({
      from: `"${config.mail.fromName}" <${config.mail.fromAddress}>`,
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
 * Send a password reset email.
 */
export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const resetUrl = `${config.app.url}/auth/password/reset/${token}`;
  await sendEmail({
    to: email,
    subject: `[${config.app.name}] Password Reset`,
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
export async function sendAccountCreatedEmail(
  email: string,
  username: string,
  setupUrl?: string
): Promise<void> {
  await sendEmail({
    to: email,
    subject: `[${config.app.name}] Account Created`,
    html: `
      <p>An account has been created for you on ${config.app.name}.</p>
      <p>Username: <strong>${username}</strong></p>
      ${setupUrl ? `<p><a href="${setupUrl}">Set up your account</a></p>` : ''}
    `,
  });
}

/**
 * Send a notification when a user is added to a server.
 */
export async function sendAddedToServerEmail(email: string, serverName: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: `[${config.app.name}] Added to Server`,
    html: `<p>You have been added as a subuser to the server <strong>${serverName}</strong>.</p>`,
  });
}

/**
 * Send a notification when a user is removed from a server.
 */
export async function sendRemovedFromServerEmail(email: string, serverName: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: `[${config.app.name}] Removed from Server`,
    html: `<p>You have been removed as a subuser from the server <strong>${serverName}</strong>.</p>`,
  });
}

/**
 * Send server installed notification.
 */
export async function sendServerInstalledEmail(email: string, serverName: string): Promise<void> {
  if (!config.pterodactyl.email.sendInstallNotification) return;
  await sendEmail({
    to: email,
    subject: `[${config.app.name}] Server Installed`,
    html: `<p>Your server <strong>${serverName}</strong> has finished installing and is now ready to use.</p>`,
  });
}
