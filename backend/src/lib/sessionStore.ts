import session from 'express-session';
import { prisma } from '../prisma/client.js';

/**
 * MySQL-backed session store matching Laravel's DatabaseSessionHandler behavior.
 *
 * Stores sessions in the `sessions` table with metadata columns
 * (user_id, ip_address, user_agent) populated from request context,
 * not from session data.
 */
export class MysqlSessionStore extends session.Store {
  private reaperInterval: ReturnType<typeof setInterval> | null = null;
  private requestContext: { ip: string | null; userAgent: string | null } = { ip: null, userAgent: null };

  constructor(private sessionLifetimeMinutes: number) {
    super();
    this.reaperInterval = setInterval(() => this.reap(), 10 * 60 * 1000);
    this.reaperInterval.unref?.();
  }

  /**
   * Set request context for the current request cycle.
   * Called by middleware before express-session writes to the store.
   */
  setRequestContext(ip: string | null, userAgent: string | null): void {
    this.requestContext = { ip, userAgent };
  }

  async get(sid: string, callback: (err?: any, session?: session.SessionData | null) => void): Promise<void> {
    try {
      const row = await prisma.sessions.findUnique({ where: { id: sid } });
      if (!row) return callback(null, null);

      const cutoff = Math.floor(Date.now() / 1000) - (this.sessionLifetimeMinutes * 60);
      if (row.last_activity < cutoff) {
        await prisma.sessions.deleteMany({ where: { id: sid } });
        return callback(null, null);
      }

      callback(null, JSON.parse(row.payload));
    } catch (err) {
      callback(err);
    }
  }

  async set(sid: string, sess: session.SessionData, callback?: (err?: any) => void): Promise<void> {
    try {
      const payload = JSON.stringify(sess);
      const last_activity = Math.floor(Date.now() / 1000);
      const user_id = (sess as any).userId ?? null;
      const ip_address = this.requestContext.ip ?? null;
      const user_agent = this.requestContext.userAgent ?? null;

      await prisma.sessions.upsert({
        where: { id: sid },
        create: { id: sid, user_id, ip_address, user_agent, payload, last_activity },
        update: { user_id, ip_address, user_agent, payload, last_activity },
      });

      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  async destroy(sid: string, callback?: (err?: any) => void): Promise<void> {
    try {
      await prisma.sessions.deleteMany({ where: { id: sid } });
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  async touch(sid: string, _sess: session.SessionData, callback?: (err?: any) => void): Promise<void> {
    try {
      await prisma.sessions.updateMany({
        where: { id: sid },
        data: { last_activity: Math.floor(Date.now() / 1000) },
      });
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  private async reap(): Promise<void> {
    try {
      const cutoff = Math.floor(Date.now() / 1000) - (this.sessionLifetimeMinutes * 60);
      await prisma.sessions.deleteMany({ where: { last_activity: { lt: cutoff } } });
    } catch {
      // Silently ignore reaper errors
    }
  }
}
