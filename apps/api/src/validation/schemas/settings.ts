import { z } from 'zod';

const numericString = (min: number, max: number) =>
    z
        .string()
        .regex(/^\d+$/, 'Must be a positive integer.')
        .refine(
            (v) => {
                const n = Number(v);
                return n >= min && n <= max;
            },
            { message: `Must be between ${min} and ${max}.` },
        );

export const updateSettingsSchema = z
    .object({
        // General
        'app:name': z.string().min(1).max(191).optional(),
        'app:locale': z.string().min(2).max(10).optional(),
        'pterodactyl:auth:2fa_required': z.enum(['0', '1', '2']).optional(),

        // Mail
        'mail:mailers:smtp:host': z.string().max(191).optional(),
        'mail:mailers:smtp:port': numericString(1, 65535).optional(),
        'mail:mailers:smtp:encryption': z.enum(['tls', 'ssl', '']).optional(),
        'mail:mailers:smtp:username': z.string().max(191).optional(),
        'mail:mailers:smtp:password': z.string().max(191).optional(),
        'mail:from:address': z.string().email().max(191).optional(),
        'mail:from:name': z.string().max(191).optional(),

        // Advanced — reCAPTCHA
        'recaptcha:enabled': z.enum(['true', 'false']).optional(),
        'recaptcha:website_key': z.string().max(191).optional(),
        'recaptcha:secret_key': z.string().max(191).optional(),

        // Advanced — HTTP timeouts
        'pterodactyl:guzzle:connect_timeout': numericString(1, 60).optional(),
        'pterodactyl:guzzle:timeout': numericString(1, 60).optional(),

        // Advanced — Automatic Allocation Creation
        'pterodactyl:client_features:allocations:enabled': z.enum(['true', 'false']).optional(),
        'pterodactyl:client_features:allocations:range_start': numericString(1024, 65535).optional(),
        'pterodactyl:client_features:allocations:range_end': numericString(1024, 65535).optional(),
    })
    .superRefine((data, ctx) => {
        // When automatic allocations are turned on, both port range fields are required
        // and the end port must be strictly greater than the start port.
        if (data['pterodactyl:client_features:allocations:enabled'] === 'true') {
            const start = data['pterodactyl:client_features:allocations:range_start'];
            const end = data['pterodactyl:client_features:allocations:range_end'];
            if (!start) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['pterodactyl:client_features:allocations:range_start'],
                    message: 'Starting port is required when automatic allocation is enabled.',
                });
            }
            if (!end) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['pterodactyl:client_features:allocations:range_end'],
                    message: 'Ending port is required when automatic allocation is enabled.',
                });
            }
            if (start && end && Number(end) <= Number(start)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['pterodactyl:client_features:allocations:range_end'],
                    message: 'Ending port must be greater than starting port.',
                });
            }
        }

        // When reCAPTCHA is turned on, the (non-secret) site key must be present.
        // The secret key is "leave blank to keep current" — see the controller's
        // handling of mail:mailers:smtp:password for the same convention.
        if (data['recaptcha:enabled'] === 'true' && !data['recaptcha:website_key']) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['recaptcha:website_key'],
                message: 'Site key is required when reCAPTCHA is enabled.',
            });
        }
    });

export type UpdateSettingsData = z.infer<typeof updateSettingsSchema>;
