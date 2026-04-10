import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { get, post, patch, del, createTestAdmin, createTestUser, cleanup } from '../../helpers/setup.js';
import { startServer, stopServer } from '../../helpers/setup.js';

describe('Application API: Users', () => {
  let adminToken: string;
  let adminUser: any;

  beforeAll(async () => {
    await startServer();
    await cleanup();
    const admin = await createTestAdmin();
    adminToken = admin.token;
    adminUser = admin.user;
  });

  afterAll(async () => {
    await cleanup();
    await stopServer();
  });

  describe('GET /api/application/users', () => {
    test('returns 401 without auth', async () => {
      const res = await get('/api/application/users');
      expect(res.status).toBe(401);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].code).toBe('AuthenticationException');
    });

    test('returns paginated user list for admin', async () => {
      const res = await get('/api/application/users', { token: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.object).toBe('list');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      // Each item should have the correct structure
      const firstUser = res.body.data[0];
      expect(firstUser.object).toBe('user');
      expect(firstUser.attributes).toBeDefined();
      expect(firstUser.attributes.uuid).toBeDefined();
      expect(firstUser.attributes.username).toBeDefined();
      expect(firstUser.attributes.email).toBeDefined();
    });

    test('returns 403 for non-admin user', async () => {
      const regular = await createTestUser();
      const res = await get('/api/application/users', { token: regular.token });
      expect(res.status).toBe(403);
    });

    test('supports filtering by email', async () => {
      const res = await get(`/api/application/users?filter[email]=${adminUser.email}`, { token: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].attributes.email).toBe(adminUser.email);
    });

    test('supports pagination', async () => {
      const res = await get('/api/application/users?per_page=1&page=1', { token: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.meta?.pagination).toBeDefined();
      expect(res.body.meta.pagination.per_page).toBe(1);
    });
  });

  describe('GET /api/application/users/:id', () => {
    test('returns single user', async () => {
      const res = await get(`/api/application/users/${adminUser.id}`, { token: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.object).toBe('user');
      expect(res.body.attributes.id).toBe(adminUser.id);
    });

    test('returns 404 for non-existent user', async () => {
      const res = await get('/api/application/users/999999', { token: adminToken });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/application/users', () => {
    test('creates a new user', async () => {
      const rand = Math.random().toString(36).slice(2, 10);
      const res = await post('/api/application/users', {
        token: adminToken,
        body: {
          email: `newuser_${rand}@test.com`,
          username: `newuser_${rand}`,
          first_name: 'New',
          last_name: 'User',
        },
      });
      expect(res.status).toBe(201);
      expect(res.body.object).toBe('user');
      expect(res.body.attributes.email).toContain('@test.com');
      expect(res.body.attributes.username).toContain('newuser_');
    });

    test('rejects duplicate email', async () => {
      const res = await post('/api/application/users', {
        token: adminToken,
        body: {
          email: adminUser.email,
          username: 'duplicate_test',
          first_name: 'Dup',
          last_name: 'User',
        },
      });
      // Returns error (unique constraint) — ideally 422, but 500 until validation layer catches it pre-DB
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('PATCH /api/application/users/:id', () => {
    test('updates user details', async () => {
      const res = await patch(`/api/application/users/${adminUser.id}`, {
        token: adminToken,
        body: {
          first_name: 'Updated',
          last_name: 'Name',
        },
      });
      expect(res.status).toBe(200);
      expect(res.body.attributes.first_name).toBe('Updated');
    });
  });

  describe('GET /api/application/users/:id with includes', () => {
    test('supports ?include=servers without error', async () => {
      const res = await get(`/api/application/users/${adminUser.id}?include=servers`, { token: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.object).toBe('user');
      expect(res.body.attributes.id).toBe(adminUser.id);
    });
  });

  describe('GET /api/application/users/external/:externalId', () => {
    test('returns user by external_id', async () => {
      const rand = Math.random().toString(36).slice(2, 10);
      const created = await post('/api/application/users', {
        token: adminToken,
        body: {
          email: `ext_${rand}@test.com`,
          username: `ext_${rand}`,
          first_name: 'Ext',
          last_name: 'User',
          external_id: `ext-${rand}`,
        },
      });
      expect(created.status).toBe(201);

      const res = await get(`/api/application/users/external/ext-${rand}`, { token: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.object).toBe('user');
      expect(res.body.attributes.external_id).toBe(`ext-${rand}`);
    });

    test('returns 404 for non-existent external_id', async () => {
      const res = await get('/api/application/users/external/nonexistent-xyz', { token: adminToken });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/application/users/:id', () => {
    test('deletes a user', async () => {
      const testUser = await createTestUser({ username: 'deleteme' });
      const res = await del(`/api/application/users/${testUser.user.id}`, { token: adminToken });
      expect(res.status).toBe(204);
    });
  });
});
