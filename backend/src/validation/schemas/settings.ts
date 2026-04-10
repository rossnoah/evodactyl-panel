import { z } from 'zod';

export const updateSettingsSchema = z.object({
  'app:name': z.string().min(1).max(191).optional(),
  'app:locale': z.string().min(2).max(10).optional(),
  'pterodactyl:auth:2fa_required': z.enum(['0', '1', '2']).optional(),
  'mail:mailers:smtp:host': z.string().max(191).optional(),
  'mail:mailers:smtp:port': z.string().max(10).optional(),
  'mail:mailers:smtp:encryption': z.enum(['tls', 'ssl', '']).optional(),
  'mail:mailers:smtp:username': z.string().max(191).optional(),
  'mail:mailers:smtp:password': z.string().max(191).optional(),
  'mail:from:address': z.string().max(191).optional(),
  'mail:from:name': z.string().max(191).optional(),
}).passthrough();

export type UpdateSettingsData = z.infer<typeof updateSettingsSchema>;
