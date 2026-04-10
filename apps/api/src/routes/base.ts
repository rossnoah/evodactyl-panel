import { Router } from 'express';
import { serveLocale } from '../controllers/base/localeController.js';

const router = Router();

// Locale/translation endpoint — still served by the API because translations
// live in packages/shared and can depend on DB-backed settings.
router.get('/locales/locale.json', serveLocale);

// Sanctum CSRF cookie endpoint — sets XSRF-TOKEN cookie for SPA auth.
// Our csrfProtection middleware sets the cookie on every request, so this
// endpoint just acknowledges it so the frontend's bootstrap sequence works.
router.get('/sanctum/csrf-cookie', (_req, res) => {
  res.status(204).end();
});

export default router;
