import express, { type Request } from 'express';
import cors from 'cors';
import session from 'express-session';
import http from 'node:http';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { setSecurityHeaders, errorHandler, csrfProtection } from './middleware/index.js';
import { startScheduler } from './scheduler/index.js';
import { MysqlSessionStore } from './lib/sessionStore.js';
import { prisma } from './prisma/client.js';

const app = express();
const httpServer = http.createServer(app);

app.set('trust proxy', true);
app.use(setSecurityHeaders);

app.use(cors({
  origin: config.app.url,
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Session — backed by the MySQL sessions table that Laravel also used so
// existing sessions survive the cutover.
const sessionStore = config.session.driver === 'database'
  ? new MysqlSessionStore(config.session.lifetime)
  : undefined;

if (sessionStore) {
  app.use((req, _res, next) => {
    sessionStore.setRequestContext(req.ip ?? null, req.headers['user-agent'] ?? null);
    next();
  });
}

app.use(session({
  store: sessionStore,
  secret: config.app.key,
  name: config.session.cookie,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.session.secure,
    httpOnly: config.session.httpOnly,
    sameSite: config.session.sameSite as 'lax' | 'strict' | 'none',
    maxAge: config.session.lifetime * 60 * 1000,
    domain: config.session.domain,
    path: config.session.path,
  },
}));

app.use(csrfProtection);

// API and auth routes FIRST so they win over the SPA catch-all.
app.use(routes);

// Paths that should 404 (or hit the api error handler) rather than fall
// through to the SPA. Anything matching one of these prefixes is owned by
// the backend exclusively.
const API_PREFIXES = ['/api/', '/sanctum/', '/locales/', '/daemon/'];
function isApiPath(pathname: string): boolean {
  return API_PREFIXES.some((p) => pathname.startsWith(p));
}

const webRoot = path.resolve(
  fileURLToPath(import.meta.url),
  '../../../web'
);
const webDistDir = path.join(webRoot, 'dist');
const isDev = config.app.env !== 'production';

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * JSON-encode a value safely for embedding inside a <script> tag. Closes off
 * `</script>` sequences and the usual LS/PS line terminators that would
 * otherwise let attackers (or accidental content) escape the tag context.
 */
function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

interface Bootstrap {
  csrfToken: string;
  siteConfiguration: {
    name: string;
    locale: string;
    recaptcha: { enabled: boolean; siteKey: string };
  };
  user: Record<string, unknown> | null;
}

async function loadBootstrap(req: Request): Promise<Bootstrap> {
  const csrfToken = req.session?.csrfToken ?? '';
  const siteConfiguration = {
    name: config.app.name,
    locale: config.app.locale,
    recaptcha: {
      enabled: false,
      siteKey: '',
    },
  };

  let user: Record<string, unknown> | null = null;
  const userId = (req.session as unknown as { userId?: number })?.userId;
  if (userId) {
    try {
      const row = await prisma.users.findUnique({ where: { id: userId } });
      if (row) {
        user = {
          uuid: row.uuid,
          username: row.username,
          email: row.email,
          name_first: row.name_first,
          name_last: row.name_last,
          language: row.language,
          root_admin: Boolean(row.root_admin),
          use_totp: Boolean(row.use_totp),
          gravatar: Boolean(row.gravatar),
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      }
    } catch {
      // Ignore DB lookup failures — the SPA will fall back to anonymous mode.
    }
  }

  return { csrfToken, siteConfiguration, user };
}

/**
 * Inject the per-session CSRF token and the bootstrap globals the SPA
 * expects into the served HTML shell. Replaces what the Laravel Blade
 * wrapper used to emit (<meta name="csrf-token">, window.SiteConfiguration,
 * window.PterodactylUser).
 */
function injectBootstrap(html: string, bootstrap: Bootstrap): string {
  const { csrfToken, siteConfiguration, user } = bootstrap;
  const csrfMeta = `<meta name="csrf-token" content="${escapeHtmlAttribute(csrfToken)}" />`;
  const bootstrapScript =
    `<script>window.SiteConfiguration = ${safeJson(siteConfiguration)};` +
    (user ? `window.PterodactylUser = ${safeJson(user)};` : '') +
    `</script>`;

  let out = html;
  if (/name="csrf-token"/.test(out)) {
    out = out.replace(
      /<meta\s+name="csrf-token"\s+content="[^"]*"\s*\/?\s*>/,
      csrfMeta
    );
  } else {
    out = out.replace(/<head>/, `<head>\n    ${csrfMeta}`);
  }

  // Insert the bootstrap globals just before </head> so they run before
  // the SPA's module script, which Vite places at the bottom of <body>.
  out = out.replace(/<\/head>/, `    ${bootstrapScript}\n  </head>`);
  return out;
}

// In dev we run Vite in middleware mode so the whole app is served from
// one port (3000) with full HMR, source maps, and on-the-fly compilation.
// In prod we serve the built static assets from apps/web/dist.
if (isDev) {
  // twin.macro resolves tailwind.config.js via process.cwd(), so we must
  // chdir into the web workspace before spinning up Vite. Without this the
  // macro falls back to the built-in Tailwind 2.x class list and rejects
  // any custom palette entries (e.g. `bg-neutral-800`, `bg-cyan-400`).
  process.chdir(webRoot);

  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    root: webRoot,
    server: {
      middlewareMode: true,
      // Pipe HMR websockets through our HTTP server so everything stays on
      // one port. Without this Vite spawns its own WS server on an
      // undefined port and crashes.
      hmr: { server: httpServer },
    },
    appType: 'custom',
  });

  app.use(vite.middlewares);

  app.use(async (req, res, next) => {
    if (req.method !== 'GET' || isApiPath(req.path)) return next();
    try {
      const template = await fs.readFile(path.join(webRoot, 'index.html'), 'utf-8');
      const transformed = await vite.transformIndexHtml(req.originalUrl, template);
      const bootstrap = await loadBootstrap(req);
      res
        .status(200)
        .setHeader('Content-Type', 'text/html; charset=utf-8')
        .setHeader('Cache-Control', 'no-store')
        .end(injectBootstrap(transformed, bootstrap));
    } catch (err) {
      vite.ssrFixStacktrace(err as Error);
      next(err);
    }
  });
} else {
  app.use(
    express.static(webDistDir, {
      index: false,
      dotfiles: 'ignore',
      maxAge: '1y',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-store');
        }
      },
    })
  );

  app.get(/^\/(?!api\/|sanctum\/|locales\/|daemon\/).*/, async (req, res, next) => {
    if (req.method !== 'GET') return next();
    try {
      const html = await fs.readFile(path.join(webDistDir, 'index.html'), 'utf-8');
      const bootstrap = await loadBootstrap(req);
      res
        .status(200)
        .setHeader('Content-Type', 'text/html; charset=utf-8')
        .setHeader('Cache-Control', 'no-store')
        .end(injectBootstrap(html, bootstrap));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        res.status(503).type('text/plain').send(
          'SPA bundle not found. Run `bun --filter @pterodactyl/web run build` ' +
          'or start in dev mode (APP_ENV!=production).'
        );
        return;
      }
      next(err);
    }
  });
}

// Global error handler (must be last).
app.use(errorHandler);

const isMainModule = import.meta.main ?? (typeof Bun !== 'undefined' && Bun.main === import.meta.path);

if (isMainModule) {
  const port = config.server.port;
  httpServer.listen(port, () => {
    console.log(`[Pterodactyl] Panel running on http://localhost:${port}`);
    console.log(`[Pterodactyl] Environment: ${config.app.env}${isDev ? ' (dev — Vite middleware + HMR)' : ''}`);
    console.log(`[Pterodactyl] Debug: ${config.app.debug}`);
    startScheduler();
  });
}

export default app;
