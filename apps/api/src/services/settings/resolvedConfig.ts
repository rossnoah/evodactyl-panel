import { config } from '../../config/index.js';
import { decrypt } from '../../lib/encryption.js';
import * as cache from './settingsCache.js';

/**
 * Mirrors panel-old's SettingsServiceProvider::castToBoolean / castToNull
 * coercion. Only call this on values that are *meant* to be boolean/null —
 * applying it to free-form string fields (e.g. locale) would silently destroy
 * legitimate inputs that happen to spell "null" or "true".
 */
function coerceBoolean(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined) return fallback;
    const v = value.toLowerCase();
    if (v === 'true' || v === '(true)' || v === '1') return true;
    if (v === 'false' || v === '(false)' || v === '0') return false;
    return fallback;
}

function coerceInt(value: string | undefined, fallback: number): number {
    if (value === undefined || value === '') return fallback;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
}

function coerceOptionalInt(value: string | undefined): number | undefined {
    if (value === undefined || value === '') return undefined;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
}

export function getAppName(): string {
    return cache.get('app:name') ?? config.app.name;
}

export function getAppLocale(): string {
    return cache.get('app:locale') ?? config.app.locale;
}

export function getTwoFactorRequirement(): 0 | 1 | 2 {
    const raw = cache.get('pterodactyl:auth:2fa_required');
    const value = coerceInt(raw, config.pterodactyl.auth.twoFactorRequired);
    if (value === 1) return 1;
    if (value === 2) return 2;
    return 0;
}

export interface ResolvedMailConfig {
    host: string;
    port: number;
    encryption: string;
    username: string;
    password: string;
    fromAddress: string;
    fromName: string;
}

export function getMailConfig(): ResolvedMailConfig {
    const rawPassword = cache.get('mail:mailers:smtp:password') ?? config.mail.password ?? '';
    let password = '';
    if (rawPassword) {
        try {
            password = decrypt(rawPassword);
        } catch {
            // Backwards compat: pre-encryption rows are stored plaintext.
            // First save through the new controller will re-encrypt them.
            password = rawPassword;
        }
    }

    return {
        host: cache.get('mail:mailers:smtp:host') ?? config.mail.host,
        port: coerceInt(cache.get('mail:mailers:smtp:port'), config.mail.port),
        encryption: cache.get('mail:mailers:smtp:encryption') ?? config.mail.encryption,
        username: cache.get('mail:mailers:smtp:username') ?? config.mail.username,
        password,
        fromAddress: cache.get('mail:from:address') ?? config.mail.fromAddress,
        fromName: cache.get('mail:from:name') ?? config.mail.fromName,
    };
}

export interface ResolvedRecaptchaConfig {
    enabled: boolean;
    siteKey: string;
    secretKey: string;
}

// Pterodactyl ships these public reCAPTCHA v2 invisible keys so the captcha
// works out of the box. Admins should swap them for their own via the
// Advanced settings tab — keys baked into a public binary share rate limits
// across every install that hasn't customised them.
export const SHIPPED_RECAPTCHA_SITE_KEY = '6LcJcjwUAAAAAO_Xqjrtj9wWufUpYRnK6BW8lnfn';
export const SHIPPED_RECAPTCHA_SECRET_KEY = '6LcJcjwUAAAAALOcDJqAEYKTDhwELCkzUkNDQ0J5';

export function getRecaptchaConfig(): ResolvedRecaptchaConfig {
    return {
        // Off by default. The shipped Pterodactyl keys above are kept as the
        // default form values so a one-click "Enable" in the Advanced tab
        // gets you working captcha without registering your own keys first.
        enabled: coerceBoolean(cache.get('recaptcha:enabled'), false),
        siteKey: cache.get('recaptcha:website_key') ?? SHIPPED_RECAPTCHA_SITE_KEY,
        secretKey: cache.get('recaptcha:secret_key') ?? SHIPPED_RECAPTCHA_SECRET_KEY,
    };
}

export function isUsingShippedRecaptchaKeys(): boolean {
    const cfg = getRecaptchaConfig();
    return cfg.siteKey === SHIPPED_RECAPTCHA_SITE_KEY || cfg.secretKey === SHIPPED_RECAPTCHA_SECRET_KEY;
}

export interface ResolvedGuzzleTimeouts {
    timeout: number;
    connectTimeout: number;
}

export function getGuzzleTimeouts(): ResolvedGuzzleTimeouts {
    return {
        timeout: coerceInt(cache.get('pterodactyl:guzzle:timeout'), config.pterodactyl.guzzle.timeout),
        connectTimeout: coerceInt(
            cache.get('pterodactyl:guzzle:connect_timeout'),
            config.pterodactyl.guzzle.connectTimeout,
        ),
    };
}

export interface ResolvedAllocationRange {
    enabled: boolean;
    rangeStart?: number;
    rangeEnd?: number;
}

export function getAllocationRange(): ResolvedAllocationRange {
    return {
        enabled: coerceBoolean(
            cache.get('pterodactyl:client_features:allocations:enabled'),
            config.pterodactyl.clientFeatures.allocations.enabled,
        ),
        rangeStart:
            coerceOptionalInt(cache.get('pterodactyl:client_features:allocations:range_start')) ??
            config.pterodactyl.clientFeatures.allocations.rangeStart,
        rangeEnd:
            coerceOptionalInt(cache.get('pterodactyl:client_features:allocations:range_end')) ??
            config.pterodactyl.clientFeatures.allocations.rangeEnd,
    };
}
