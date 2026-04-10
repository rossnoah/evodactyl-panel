import { z } from 'zod';

/**
 * Zod-validated environment schema for the Pterodactyl Panel. This is the
 * single source of truth for which environment variables the app reads and
 * how they are parsed. Use {@link loadEnv} to read and validate them.
 *
 * Migration from Laravel `.env`:
 *   - APP_KEY          — same, must remain intact so Laravel-encrypted secrets
 *                        (SMTP password, daemon tokens, 2FA secrets) still
 *                        decrypt under the TS stack.
 *   - APP_URL          — same.
 *   - DB_*             — still used by the Prisma client implicitly when
 *                        DATABASE_URL is not set.
 *   - DATABASE_URL     — new canonical form, preferred over DB_* pieces.
 *   - MAIL_*           — same.
 *   - SESSION_*        — same, but SESSION_DRIVER=database uses our custom
 *                        MySQL session store instead of Laravel's.
 *   - REDIS_*          — same.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  APP_NAME: z.string().default('Pterodactyl'),
  APP_ENV: z.string().default('production'),
  APP_DEBUG: booleanFromString().default('false'),
  APP_URL: z.string().url().default('http://localhost'),
  APP_TIMEZONE: z.string().default('UTC'),
  APP_LOCALE: z.string().default('en'),
  APP_KEY: z
    .string()
    .regex(/^(base64:)?[A-Za-z0-9+/=]+$/u, {
      message: 'APP_KEY must be a base64-encoded 32-byte key, optionally prefixed with "base64:"',
    }),

  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url().optional(),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_DATABASE: z.string().default('panel'),
  DB_USERNAME: z.string().default('pterodactyl'),
  DB_PASSWORD: z.string().default(''),

  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DATABASE: z.coerce.number().int().nonnegative().default(0),

  SESSION_DRIVER: z.enum(['database', 'redis', 'memory']).default('database'),
  SESSION_LIFETIME: z.coerce.number().int().positive().default(720),
  SESSION_COOKIE: z.string().default('pterodactyl_session'),
  SESSION_SECURE_COOKIE: booleanFromString().optional(),
  SESSION_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  SESSION_HTTP_ONLY: booleanFromString().default('true'),
  SESSION_DOMAIN: z.string().optional(),
  SESSION_PATH: z.string().default('/'),
  SESSION_ENCRYPT: booleanFromString().default('true'),

  MAIL_HOST: z.string().default('smtp.example.com'),
  MAIL_PORT: z.coerce.number().int().positive().default(25),
  MAIL_USERNAME: z.string().optional(),
  MAIL_PASSWORD: z.string().optional(),
  MAIL_ENCRYPTION: z.string().default('tls'),
  MAIL_FROM_ADDRESS: z.string().email().default('no-reply@example.com'),
  MAIL_FROM_NAME: z.string().default('Pterodactyl Panel'),

  HASHIDS_SALT: z.string().default(''),
  HASHIDS_LENGTH: z.coerce.number().int().positive().default(8),

  APP_API_CLIENT_RATELIMIT: z.coerce.number().int().positive().default(256),
  APP_API_APPLICATION_RATELIMIT: z.coerce.number().int().positive().default(256),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse the given record (usually `process.env`) against the schema and
 * throw a formatted error listing every invalid variable.
 */
export function loadEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(raw);
  if (result.success) return result.data;

  const issues = result.error.issues
    .map((i) => `  ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(
    `Environment validation failed:\n${issues}\n\n` +
      'Check your .env file against packages/shared/src/env.ts.'
  );
}

function booleanFromString() {
  return z
    .union([z.boolean(), z.string()])
    .transform((v) => {
      if (typeof v === 'boolean') return v;
      const normalized = v.toLowerCase().trim();
      return normalized === 'true' || normalized === '1' || normalized === 'yes';
    });
}
