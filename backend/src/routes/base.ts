import { Router } from 'express';
import { serveSpa } from '../controllers/base/indexController.js';
import { serveLocale } from '../controllers/base/localeController.js';

const router = Router();

// Locale/translation endpoint
router.get('/locales/locale.json', serveLocale);

// Sanctum CSRF cookie endpoint — sets XSRF-TOKEN cookie for SPA auth
// Mirrors Laravel Sanctum's GET /sanctum/csrf-cookie
router.get('/sanctum/csrf-cookie', (req, res) => {
  // The CSRF middleware already sets the XSRF-TOKEN cookie on every request.
  // This endpoint just needs to return 204 so the frontend knows the cookie is set.
  res.status(204).end();
});

// Explicit SPA routes (these must serve the React shell, not 404)
router.get('/', serveSpa);
router.get('/auth/login', serveSpa);
router.get('/auth/login/checkpoint', serveSpa);
router.get('/auth/password', serveSpa);
router.get('/auth/password/reset/:token', serveSpa);
router.get('/account', serveSpa);
router.get('/account/:path', serveSpa);

// Catch-all for any other frontend routes (server pages, etc.)
// Uses Express 5 unnamed wildcard. Excludes API/admin/daemon prefixes.
router.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const reqPath = req.path;
  if (
    reqPath.startsWith('/api/') ||
    reqPath.startsWith('/auth/') ||
    reqPath.startsWith('/daemon/')
  ) {
    return next();
  }
  // If it looks like a file request (has extension), skip
  if (reqPath.includes('.') && !reqPath.endsWith('.html')) return next();
  serveSpa(req, res);
});

export default router;
