import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { get, createTestUser, cleanup } from '../../helpers/setup.js';
import { startServer, stopServer } from '../../helpers/setup.js';
import { prisma } from '../../../src/prisma/client.js';

describe('Client API: Activity Log', () => {
  let token: string;
  let user: any;

  beforeAll(async () => {
    await startServer();
    const testUser = await createTestUser();
    token = testUser.token;
    user = testUser.user;

    // Seed some activity log entries for the user
    for (let i = 0; i < 8; i++) {
      await prisma.activity_logs.create({
        data: {
          event: `auth:test-event-${i}`,
          ip: '127.0.0.1',
          actor_type: 'Pterodactyl\\Models\\User',
          actor_id: BigInt(user.id),
          properties: '{}',
          timestamp: new Date(),
        },
      });
    }
  });

  afterAll(async () => {
    await cleanup();
    await stopServer();
  });

  describe('GET /api/client/account/activity', () => {
    test('returns 401 without auth', async () => {
      const res = await get('/api/client/account/activity');
      expect(res.status).toBe(401);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].code).toBe('AuthenticationException');
    });

    test('returns 200 with list format', async () => {
      const res = await get('/api/client/account/activity', { token });
      expect(res.status).toBe(200);
      expect(res.body.object).toBe('list');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    test('each activity entry has correct structure', async () => {
      const res = await get('/api/client/account/activity', { token });
      expect(res.status).toBe(200);
      const entry = res.body.data[0];
      expect(entry.object).toBe('activity_log');
      expect(entry.attributes).toBeDefined();
      expect(entry.attributes.event).toBeDefined();
      expect(entry.attributes.ip).toBeDefined();
      expect(entry.attributes.timestamp).toBeDefined();
    });

    test('supports pagination', async () => {
      const res = await get('/api/client/account/activity?page=1&per_page=3', { token });
      expect(res.status).toBe(200);
      expect(res.body.object).toBe('list');
      expect(res.body.data.length).toBeLessThanOrEqual(3);
      expect(res.body.meta?.pagination).toBeDefined();
      expect(res.body.meta.pagination.per_page).toBe(3);
    });

    test('supports filtering by event', async () => {
      const res = await get('/api/client/account/activity?filter[event]=auth:test-event', { token });
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const entry of res.body.data) {
        expect(entry.attributes.event).toContain('auth:test-event');
      }
    });

    test('returns empty list for filter with no matches', async () => {
      const res = await get('/api/client/account/activity?filter[event]=nonexistent-event-xyz', { token });
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });
  });
});
