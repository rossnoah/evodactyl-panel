import { prisma } from '../../prisma/client.js';

/**
 * Keys whose stored values are sensitive and must never be returned to the
 * frontend. The mail password is encrypted at rest; the recaptcha secret is
 * a Google-issued credential. Both are write-only from the admin UI.
 */
const SECRET_KEYS = new Set(['mail:mailers:smtp:password', 'recaptcha:secret_key']);

/**
 * Retrieve all settings as a key-value object — including secrets.
 * Used by the in-process settings cache loader so resolved-config accessors
 * can decrypt secrets when constructing typed config objects.
 */
export async function getAllSettingsRaw(): Promise<Record<string, string>> {
    const rows = await prisma.settings.findMany();
    const result: Record<string, string> = {};
    for (const row of rows) {
        result[row.key] = row.value;
    }
    return result;
}

/**
 * Retrieve all settings safe to return over the API. Strips secret keys.
 */
export async function getAllSettingsForApi(): Promise<Record<string, string>> {
    const all = await getAllSettingsRaw();
    for (const key of SECRET_KEYS) {
        delete all[key];
    }
    return all;
}

/**
 * Upsert multiple settings at once.
 */
export async function updateSettings(data: Record<string, string>): Promise<void> {
    const operations = Object.entries(data).map(([key, value]) =>
        prisma.settings.upsert({
            where: { key },
            update: { value },
            create: { key, value },
        }),
    );

    await prisma.$transaction(operations);
}
