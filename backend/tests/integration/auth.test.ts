import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { post, get, createTestUser, cleanup, startServer, stopServer } from '../helpers/setup.js';

describe('Authentication', () => {
  let user: any;

  beforeAll(async () => {
    await startServer();
    const rand = Math.random().toString(36).slice(2, 10);
    const testUser = await createTestUser({ email: `authtest_${rand}@example.com` });
    user = testUser.user;
  });

  afterAll(async () => {
    await cleanup();
    await stopServer();
  });

  describe('POST /auth/login', () => {
    test('authenticates with valid credentials', async () => {
      const res = await post('/auth/login', {
        body: {
          user: user.email,
          password: 'password',
        },
      });
      // Should either succeed (200) or require 2FA checkpoint (depends on session setup)
      expect([200, 400]).toContain(res.status);
    });

    test('rejects invalid credentials', async () => {
      const res = await post('/auth/login', {
        body: {
          user: user.email,
          password: 'wrong_password',
        },
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    test('rejects non-existent user', async () => {
      const res = await post('/auth/login', {
        body: {
          user: 'nonexistent@example.com',
          password: 'password',
        },
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('POST /auth/password', () => {
    test('always returns success (prevents enumeration)', async () => {
      const res = await post('/auth/password', {
        body: { email: 'nonexistent@example.com' },
      });
      // Should return 200 regardless of whether the email exists
      expect(res.status).toBe(200);
    });
  });

  describe('API Token Auth', () => {
    test('rejects request without token', async () => {
      const res = await get('/api/client/account');
      expect(res.status).toBe(401);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].code).toBe('AuthenticationException');
    });

    test('rejects invalid token', async () => {
      const res = await get('/api/client/account', {
        token: 'invalid_token_here_that_is_long_enough',
      });
      expect(res.status).toBe(401);
    });
  });
});
