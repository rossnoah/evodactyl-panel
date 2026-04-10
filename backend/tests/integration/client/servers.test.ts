import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { get, createTestUser, createTestAdmin, cleanup } from '../../helpers/setup.js';
import { startServer, stopServer } from '../../helpers/setup.js';

describe('Client API: Server Listing', () => {
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    await startServer();
    const user = await createTestUser();
    userToken = user.token;
    const admin = await createTestAdmin();
    adminToken = admin.token;
  });

  afterAll(async () => {
    await cleanup();
    await stopServer();
  });

  describe('GET /api/client', () => {
    test('returns server list for user', async () => {
      const res = await get('/api/client', { token: userToken });
      expect(res.status).toBe(200);
      expect(res.body.object).toBe('list');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('admin can filter by type=admin', async () => {
      const res = await get('/api/client?type=admin', { token: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.object).toBe('list');
    });
  });

  describe('GET /api/client/permissions', () => {
    test('returns permission list', async () => {
      const res = await get('/api/client/permissions', { token: userToken });
      expect(res.status).toBe(200);
      expect(res.body.attributes).toBeDefined();
      expect(res.body.attributes.permissions).toBeDefined();
    });
  });
});
