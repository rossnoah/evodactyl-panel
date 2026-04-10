import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { get, put, post, del, createTestUser, cleanup } from '../../helpers/setup.js';
import { startServer, stopServer } from '../../helpers/setup.js';

describe('Client API: Account', () => {
  let token: string;
  let user: any;

  beforeAll(async () => {
    await startServer();
    const testUser = await createTestUser();
    token = testUser.token;
    user = testUser.user;
  });

  afterAll(async () => {
    await cleanup();
    await stopServer();
  });

  describe('GET /api/client/account', () => {
    test('returns current user info', async () => {
      const res = await get('/api/client/account', { token });
      expect(res.status).toBe(200);
      expect(res.body.object).toBe('user');
      expect(res.body.attributes.email).toBe(user.email);
      expect(res.body.attributes.username).toBe(user.username);
      // Should not expose sensitive fields
      expect(res.body.attributes.password).toBeUndefined();
      expect(res.body.attributes.totp_secret).toBeUndefined();
    });
  });

  describe('PUT /api/client/account/password', () => {
    test('rejects wrong current password', async () => {
      const res = await put('/api/client/account/password', {
        token,
        body: {
          current_password: 'wrong_password',
          password: 'newpassword123',
          password_confirmation: 'newpassword123',
        },
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/client/account/api-keys', () => {
    test('returns user API keys', async () => {
      const res = await get('/api/client/account/api-keys', { token });
      expect(res.status).toBe(200);
      expect(res.body.object).toBe('list');
    });
  });

  describe('GET /api/client/account/ssh-keys', () => {
    test('returns user SSH keys', async () => {
      const res = await get('/api/client/account/ssh-keys', { token });
      expect(res.status).toBe(200);
      expect(res.body.object).toBe('list');
    });
  });
});
