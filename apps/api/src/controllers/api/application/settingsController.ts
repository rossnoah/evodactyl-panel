import type { NextFunction, Request, Response } from '@/types/express.js';
import { getAllSettings, updateSettings } from '../../../services/settings/settingsService.js';
import { updateSettingsSchema } from '../../../validation/schemas/settings.js';

/**
 * Get all settings.
 * GET /api/application/settings
 */
export const index = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const settings = await getAllSettings();
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

        // Build a clean key-value map from validated data
        const data: Record<string, string> = {};
        for (const [key, value] of Object.entries(validated)) {
            if (value !== undefined) {
                data[key] = String(value);
            }
        }

        await updateSettings(data);
        const settings = await getAllSettings();
        res.json({ data: settings });
    } catch (err) {
        next(err);
    }
};
