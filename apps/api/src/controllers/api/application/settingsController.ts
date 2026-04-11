import type { NextFunction, Request, Response } from '@/types/express.js';
import { encrypt } from '../../../lib/encryption.js';
import { invalidateTransporter, sendTestEmail } from '../../../notifications/index.js';
import { getAllSettingsForApi, updateSettings } from '../../../services/settings/settingsService.js';
import * as settingsCache from '../../../services/settings/settingsCache.js';
import { updateSettingsSchema } from '../../../validation/schemas/settings.js';

const MAIL_PASSWORD_KEY = 'mail:mailers:smtp:password';
const RECAPTCHA_SECRET_KEY = 'recaptcha:secret_key';
const SECRET_KEEP_BLANK_KEYS = new Set([MAIL_PASSWORD_KEY, RECAPTCHA_SECRET_KEY]);

/**
 * Get all settings.
 * GET /api/application/settings
 */
export const index = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const settings = await getAllSettingsForApi();
        res.json({ data: settings });
    } catch (err) {
        next(err);
    }
};

/**
 * Update settings.
 * PATCH /api/application/settings
 */
export const update = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const validated = updateSettingsSchema.parse(req.body);

        const data: Record<string, string> = {};
        for (const [key, rawValue] of Object.entries(validated)) {
            if (rawValue === undefined) continue;
            let value = String(rawValue);

            // Blank-string secrets mean "keep the current value." Pterodactyl's
            // mail.blade.php uses this convention; we extend it to the
            // recaptcha secret because both fields are stripped from GET.
            if (SECRET_KEEP_BLANK_KEYS.has(key) && value === '') {
                continue;
            }

            // Mail password gets encrypted at rest. The "!e" sentinel
            // explicitly clears the stored password (mirrors panel-old's
            // MailController::update behavior).
            if (key === MAIL_PASSWORD_KEY) {
                value = encrypt(value === '!e' ? '' : value);
            }

            data[key] = value;
        }

        if (Object.keys(data).length > 0) {
            await updateSettings(data);
            await settingsCache.refresh();
            // Drop the cached SMTP transporter so the next send picks up
            // any host/port/credential changes.
            invalidateTransporter();
        }

        const settings = await getAllSettingsForApi();
        res.json({ data: settings });
    } catch (err) {
        next(err);
    }
};

/**
 * Send a test email to the authenticated admin's address using the
 * current mail configuration.
 * POST /api/application/settings/mail/test
 */
export const testMail = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = (req as any).user;
        if (!user?.email) {
            res.status(400).json({ error: 'Authenticated user has no email address.' });
            return;
        }
        try {
            await sendTestEmail(user.email);
            res.status(204).end();
        } catch (err) {
            res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
        }
    } catch (err) {
        next(err);
    }
};
