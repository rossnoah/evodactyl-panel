// Auth middleware
export { sanctumAuth } from './auth/sanctumAuth.js';
export { authenticateIPAccess } from './auth/authenticateIPAccess.js';
export { requireTwoFactor } from './auth/requireTwoFactor.js';

// API-specific middleware
export { authenticateApplicationUser } from './api/application/authenticateApplicationUser.js';
export { daemonAuthenticate } from './api/daemon/daemonAuthenticate.js';
export { authenticateServerAccess } from './api/client/server/authenticateServerAccess.js';
export { resourceBelongsToServer } from './api/client/server/resourceBelongsToServer.js';

// Common middleware
export { errorHandler } from './common/errorHandler.js';
export { setSecurityHeaders } from './common/setSecurityHeaders.js';
export { csrfProtection } from './common/csrf.js';
export {
  applicationRateLimit,
  clientRateLimit,
  authRateLimit,
  passwordResetRateLimit,
} from './common/rateLimiter.js';
