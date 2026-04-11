import { getRecaptchaConfig } from '../settings/resolvedConfig.js';

const SITEVERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

interface SiteverifyResponse {
    success: boolean;
    challenge_ts?: string;
    hostname?: string;
    'error-codes'?: string[];
}

/**
 * Verify a reCAPTCHA v2 response token against Google's siteverify endpoint.
 * Returns true (pass-through) when reCAPTCHA is disabled at the panel level.
 * Network errors are treated as a failure to avoid silently auth-bypassing
 * when Google is unreachable.
 */
export async function verifyRecaptcha(token: string | undefined, remoteIp?: string): Promise<boolean> {
    const cfg = getRecaptchaConfig();
    if (!cfg.enabled) return true;
    if (!token || !cfg.secretKey) return false;

    const params = new URLSearchParams({
        secret: cfg.secretKey,
        response: token,
    });
    if (remoteIp) params.append('remoteip', remoteIp);

    try {
        const res = await fetch(SITEVERIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });
        if (!res.ok) return false;
        const json = (await res.json()) as SiteverifyResponse;
        return json.success === true;
    } catch (err) {
        console.warn('[reCAPTCHA] siteverify call failed:', err);
        return false;
    }
}
