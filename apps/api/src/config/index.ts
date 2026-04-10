import 'dotenv/config';

function env(key: string, defaultValue?: string): string {
  return process.env[key] ?? defaultValue ?? '';
}

function envBool(key: string, defaultValue: boolean = false): boolean {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  return val === 'true' || val === '1';
}

function envInt(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export const config = {
  app: {
    name: env('APP_NAME', 'Pterodactyl'),
    env: env('APP_ENV', 'production'),
    debug: envBool('APP_DEBUG', false),
    url: env('APP_URL', 'http://localhost'),
    timezone: env('APP_TIMEZONE', 'UTC'),
    locale: env('APP_LOCALE', 'en'),
    key: env('APP_KEY'),
    version: 'canary',
    reportAllExceptions: envBool('APP_REPORT_ALL_EXCEPTIONS', false),
  },

  server: {
    port: envInt('PORT', 3000),
  },

  database: {
    host: env('DB_HOST', '127.0.0.1'),
    port: envInt('DB_PORT', 3306),
    database: env('DB_DATABASE', 'panel'),
    username: env('DB_USERNAME', 'pterodactyl'),
    password: env('DB_PASSWORD', ''),
    url: env('DATABASE_URL'),
  },

  redis: {
    host: env('REDIS_HOST', '127.0.0.1'),
    port: envInt('REDIS_PORT', 6379),
    password: env('REDIS_PASSWORD'),
    database: envInt('REDIS_DATABASE', 0),
  },

  session: {
    driver: env('SESSION_DRIVER', 'database'),
    lifetime: envInt('SESSION_LIFETIME', 720),
    cookie: env('SESSION_COOKIE', 'pterodactyl_session'),
    secure: process.env['SESSION_SECURE_COOKIE'] !== undefined
      ? envBool('SESSION_SECURE_COOKIE')
      : undefined,
    sameSite: env('SESSION_SAME_SITE', 'lax') as 'lax' | 'strict' | 'none',
    httpOnly: envBool('SESSION_HTTP_ONLY', true),
    domain: process.env['SESSION_DOMAIN'] || undefined,
    path: env('SESSION_PATH', '/'),
    encrypt: envBool('SESSION_ENCRYPT', true),
  },

  hashids: {
    salt: env('HASHIDS_SALT', ''),
    length: envInt('HASHIDS_LENGTH', 8),
    alphabet: env('HASHIDS_ALPHABET', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'),
  },

  mail: {
    host: env('MAIL_HOST', 'smtp.example.com'),
    port: envInt('MAIL_PORT', 25),
    username: env('MAIL_USERNAME'),
    password: env('MAIL_PASSWORD'),
    encryption: env('MAIL_ENCRYPTION', 'tls'),
    fromAddress: env('MAIL_FROM_ADDRESS', 'no-reply@example.com'),
    fromName: env('MAIL_FROM_NAME', 'Pterodactyl Panel'),
  },

  http: {
    rateLimit: {
      clientPeriod: 1,
      client: envInt('APP_API_CLIENT_RATELIMIT', 256),
      applicationPeriod: 1,
      application: envInt('APP_API_APPLICATION_RATELIMIT', 256),
    },
  },

  pterodactyl: {
    loadEnvironmentOnly: envBool('APP_ENVIRONMENT_ONLY', false),
    service: {
      author: env('APP_SERVICE_AUTHOR', 'unknown@unknown.com'),
    },
    auth: {
      twoFactorRequired: envInt('APP_2FA_REQUIRED', 0),
      twoFactor: {
        bytes: 32,
        window: envInt('APP_2FA_WINDOW', 4),
        verifyNewer: true,
      },
    },
    paginate: {
      frontend: { servers: envInt('APP_PAGINATE_FRONT_SERVERS', 15) },
      admin: {
        servers: envInt('APP_PAGINATE_ADMIN_SERVERS', 25),
        users: envInt('APP_PAGINATE_ADMIN_USERS', 25),
      },
      api: {
        nodes: envInt('APP_PAGINATE_API_NODES', 25),
        servers: envInt('APP_PAGINATE_API_SERVERS', 25),
        users: envInt('APP_PAGINATE_API_USERS', 25),
      },
    },
    guzzle: {
      timeout: envInt('GUZZLE_TIMEOUT', 15),
      connectTimeout: envInt('GUZZLE_CONNECT_TIMEOUT', 5),
    },
    clientFeatures: {
      databases: {
        enabled: envBool('PTERODACTYL_CLIENT_DATABASES_ENABLED', true),
        allowRandom: envBool('PTERODACTYL_CLIENT_DATABASES_ALLOW_RANDOM', true),
      },
      schedules: {
        perScheduleTaskLimit: envInt('PTERODACTYL_PER_SCHEDULE_TASK_LIMIT', 10),
      },
      allocations: {
        enabled: envBool('PTERODACTYL_CLIENT_ALLOCATIONS_ENABLED', false),
        rangeStart: process.env['PTERODACTYL_CLIENT_ALLOCATIONS_RANGE_START']
          ? envInt('PTERODACTYL_CLIENT_ALLOCATIONS_RANGE_START', 0)
          : undefined,
        rangeEnd: process.env['PTERODACTYL_CLIENT_ALLOCATIONS_RANGE_END']
          ? envInt('PTERODACTYL_CLIENT_ALLOCATIONS_RANGE_END', 0)
          : undefined,
      },
    },
    files: {
      maxEditSize: envInt('PTERODACTYL_FILES_MAX_EDIT_SIZE', 1024 * 1024 * 4),
    },
    environmentVariables: {
      P_SERVER_ALLOCATION_LIMIT: 'allocation_limit',
    } as Record<string, string>,
    email: {
      sendInstallNotification: envBool('PTERODACTYL_SEND_INSTALL_NOTIFICATION', true),
      sendReinstallNotification: envBool('PTERODACTYL_SEND_REINSTALL_NOTIFICATION', true),
    },
    telemetry: {
      enabled: envBool('PTERODACTYL_TELEMETRY_ENABLED', true),
    },
  },
} as const;

export type Config = typeof config;
