import express from 'express';
import cors from 'cors';
import session from 'express-session';
import path from 'node:path';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { setSecurityHeaders, errorHandler, csrfProtection } from './middleware/index.js';
import { startScheduler } from './scheduler/index.js';
import { MysqlSessionStore } from './lib/sessionStore.js';

const app = express();

// Trust proxies (nginx, load balancers)
app.set('trust proxy', true);

// Security headers
app.use(setSecurityHeaders);

// CORS
app.use(cors({
  origin: config.app.url,
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Session
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

// CSRF protection (after session, before routes)
app.use(csrfProtection);

// Static files — serve from the existing Laravel public directory
const publicPath = path.resolve(import.meta.dir, '../..', 'public');
app.use(express.static(publicPath, {
  index: false, // Don't serve index.php
  dotfiles: 'ignore',
}));

// Routes
app.use(routes);

// Global error handler (must be last — matches Pterodactyl JSON:API error format)
app.use(errorHandler);

// Only auto-start when run directly (not imported by tests)
const isMainModule = import.meta.main ?? (typeof Bun !== 'undefined' && Bun.main === import.meta.path);

if (isMainModule) {
  const port = config.server.port;
  app.listen(port, () => {
    console.log(`[Pterodactyl] Backend running on port ${port}`);
    console.log(`[Pterodactyl] Environment: ${config.app.env}`);
    console.log(`[Pterodactyl] Debug: ${config.app.debug}`);

    // Start the background task scheduler
    startScheduler();
  });
}

export default app;
