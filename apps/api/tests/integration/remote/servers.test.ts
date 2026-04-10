import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { get, post, createTestAdmin, createTestLocation, createTestNode, cleanup } from '../../helpers/setup.js';
import { startServer, stopServer } from '../../helpers/setup.js';
import { decrypt } from '../../../src/lib/encryption.js';

describe('Remote API: Servers', () => {
  let daemonToken: string;
  let node: any;

  beforeAll(async () => {
    await startServer();
    const location = await createTestLocation();
    node = await createTestNode(location.id);
    // Build the daemon auth token: <daemon_token_id>.<plain_token>
    const plainToken = decrypt(node.daemon_token);
    daemonToken = `${node.daemon_token_id}.${plainToken}`;
  });

  afterAll(async () => {
    await cleanup();
    await stopServer();
  });

  describe('GET /api/remote/servers', () => {
    test('returns server list for authenticated daemon', async () => {
      const res = await get('/api/remote/servers', { token: daemonToken });
      expect(res.status).toBe(200);
    });

    test('rejects invalid daemon token', async () => {
      const res = await get('/api/remote/servers', { token: 'invalid.token' });
      expect(res.status).toBe(403);
      expect(res.body.errors[0].code).toBe('AccessDeniedHttpException');
    });

    test('rejects malformed token', async () => {
      const res = await get('/api/remote/servers', { token: 'no-dot-here' });
      expect(res.status).toBe(400);
    });
  });
});
