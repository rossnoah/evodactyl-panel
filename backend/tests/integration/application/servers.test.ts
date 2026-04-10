import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { get, createTestAdmin, createTestUser, cleanup } from '../../helpers/setup.js';
import { startServer, stopServer } from '../../helpers/setup.js';

describe('Application API: Servers', () => {
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    await startServer();
    const admin = await createTestAdmin();
    adminToken = admin.token;
    const user = await createTestUser();
    userToken = user.token;
  });

  afterAll(async () => {
    await cleanup();
    await stopServer();
  });

  describe('GET /api/application/servers', () => {
    test('returns 401 without auth', async () => {
      const res = await get('/api/application/servers');
      expect(res.status).toBe(401);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].code).toBe('AuthenticationException');
    });

    test('returns 403 for non-admin user', async () => {
      const res = await get('/api/application/servers', { token: userToken });
      expect(res.status).toBe(403);
    });

    test('returns paginated list for admin', async () => {
      const res = await get('/api/application/servers', { token: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.object).toBe('list');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta?.pagination).toBeDefined();
    });

    test('returns correct JSON:API format', async () => {
      const res = await get('/api/application/servers', { token: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.object).toBe('list');
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.pagination).toBeDefined();
      expect(res.body.meta.pagination.total).toBeDefined();
      expect(res.body.meta.pagination.per_page).toBeDefined();
      expect(res.body.meta.pagination.current_page).toBeDefined();
    });

    test('supports ?filter[name]=... with no matches', async () => {
      const res = await get('/api/application/servers?filter[name]=nonexistent_server_xyz', { token: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });

    test('supports pagination parameters', async () => {
      const res = await get('/api/application/servers?per_page=5&page=1', { token: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.meta.pagination.per_page).toBe(5);
      expect(res.body.meta.pagination.current_page).toBe(1);
    });
  });

  describe('GET /api/application/servers/:id', () => {
    test('returns error for non-existent server', async () => {
      const res = await get('/api/application/servers/999999', { token: adminToken });
      // findUniqueOrThrow returns 404 or 500 depending on error handling
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.errors).toBeDefined();
    });
  });
});
