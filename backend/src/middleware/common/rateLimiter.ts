import rateLimit from 'express-rate-limit';
import { config } from '../../config/index.js';

/**
 * Rate limiter for the Application API.
 * Mirrors config/http.php rate_limit.application settings.
 */
export const applicationRateLimit = rateLimit({
  windowMs: (config.http.rateLimit.applicationPeriod) * 60 * 1000,
  max: config.http.rateLimit.application,
  keyGenerator: (req) => {
    const user = (req as any).user;
    return user?.uuid ?? req.ip ?? 'unknown';
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for the Client API.
 */
export const clientRateLimit = rateLimit({
  windowMs: (config.http.rateLimit.clientPeriod) * 60 * 1000,
  max: config.http.rateLimit.client,
  keyGenerator: (req) => {
    const user = (req as any).user;
    return user?.uuid ?? req.ip ?? 'unknown';
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Auth route rate limiter (10 requests per minute).
 */
export const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.ip ?? 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Password reset rate limiter (2 requests per minute).
 */
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 2,
  keyGenerator: (req) => req.ip ?? 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
});
