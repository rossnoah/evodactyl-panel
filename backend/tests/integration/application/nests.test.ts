import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { get, createTestAdmin, cleanup } from '../../helpers/setup.js';
import { startServer, stopServer } from '../../helpers/setup.js';

describe('Application API: Nests', () => {
  let adminToken: string;

  beforeAll(async () => {
    await startServer();
    const admin = await createTestAdmin();
    adminToken = admin.token;
  });

  afterAll(async () => {
    await cleanup();
    await stopServer();
  });

  describe('GET /api/application/nests', () => {
    test('returns nest list', async () => {
      const res = await get('/api/application/nests', { token: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.object).toBe('list');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('supports ?include=eggs', async () => {
      const res = await get('/api/application/nests?include=eggs', { token: adminToken });
      expect(res.status).toBe(200);
      if (res.body.data.length > 0) {
        expect(res.body.data[0].relationships?.eggs).toBeDefined();
      }
    });
  });
});
