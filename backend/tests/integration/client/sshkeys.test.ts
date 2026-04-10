import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { get, post, createTestUser, cleanup } from '../../helpers/setup.js';
import { startServer, stopServer } from '../../helpers/setup.js';
import { prisma } from '../../../src/prisma/client.js';

const TEST_SSH_KEY = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGtIhFNx0gikpw9Kv3U2JMfC2ME4qlZg7TuIAZcRN3mF test@test';

describe('Client API: SSH Keys', () => {
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

  describe('SSH key lifecycle', () => {
    let createdFingerprint: string;

    test('GET /api/client/account/ssh-keys returns empty list initially', async () => {
      const res = await get('/api/client/account/ssh-keys', { token });
      expect(res.status).toBe(200);
      expect(res.body.object).toBe('list');
      expect(res.body.data).toEqual([]);
    });

    test('POST /api/client/account/ssh-keys creates a key', async () => {
      const res = await post('/api/client/account/ssh-keys', {
        token,
        body: {
          name: 'Test Key',
          public_key: TEST_SSH_KEY,
        },
      });
      expect(res.status).toBe(200);
      expect(res.body.object).toBe('ssh_key');
      expect(res.body.attributes.name).toBe('Test Key');
      expect(res.body.attributes.fingerprint).toBeDefined();
      expect(res.body.attributes.fingerprint).toContain('SHA256:');
      createdFingerprint = res.body.attributes.fingerprint;
    });

    test('GET /api/client/account/ssh-keys shows the created key', async () => {
      const res = await get('/api/client/account/ssh-keys', { token });
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].attributes.name).toBe('Test Key');
      expect(res.body.data[0].attributes.fingerprint).toBe(createdFingerprint);
    });

    test('POST /api/client/account/ssh-keys/remove soft-deletes the key', async () => {
      const res = await post('/api/client/account/ssh-keys/remove', {
        token,
        body: { fingerprint: createdFingerprint },
      });
      expect(res.status).toBe(204);
    });

    test('GET /api/client/account/ssh-keys no longer shows the deleted key', async () => {
      const res = await get('/api/client/account/ssh-keys', { token });
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });

    test('deleted key still exists in DB with deleted_at set', async () => {
      const keys = await prisma.user_ssh_keys.findMany({
        where: { user_id: user.id },
      });
      expect(keys.length).toBe(1);
      expect(keys[0].deleted_at).not.toBeNull();
      expect(keys[0].fingerprint).toBe(createdFingerprint);
    });
  });

  describe('SSH key validation', () => {
    test('rejects missing name', async () => {
      const res = await post('/api/client/account/ssh-keys', {
        token,
        body: { public_key: TEST_SSH_KEY },
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.errors).toBeDefined();
    });

    test('rejects missing public_key', async () => {
      const res = await post('/api/client/account/ssh-keys', {
        token,
        body: { name: 'No Key' },
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.errors).toBeDefined();
    });

    test('returns 401 without auth', async () => {
      const res = await get('/api/client/account/ssh-keys');
      expect(res.status).toBe(401);
    });
  });
});
