import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { get, post, patch, del, createTestAdmin, createTestLocation, cleanup } from '../../helpers/setup.js';
import { startServer, stopServer } from '../../helpers/setup.js';

describe('Application API: Nodes', () => {
  let adminToken: string;
  let locationId: number;

  beforeAll(async () => {
    await startServer();
    const admin = await createTestAdmin();
    adminToken = admin.token;
    const location = await createTestLocation();
    locationId = location.id;
  });

  afterAll(async () => {
    await cleanup();
    await stopServer();
  });

  describe('POST /api/application/nodes', () => {
    test('creates a new node', async () => {
      const res = await post('/api/application/nodes', {
        token: adminToken,
        body: {
          name: 'Test Node',
          location_id: locationId,
          fqdn: 'node1.test.local',
          scheme: 'https',
          memory: 4096,
          memory_overallocate: 0,
          disk: 20000,
          disk_overallocate: 0,
          upload_size: 100,
          daemon_listen: 8080,
          daemon_sftp: 2022,
          daemon_base: '/var/lib/pterodactyl/volumes',
        },
      });
      expect(res.status).toBe(201);
      expect(res.body.object).toBe('node');
      expect(res.body.attributes.name).toBe('Test Node');
      expect(res.body.attributes.fqdn).toBe('node1.test.local');
    });
  });

  describe('GET /api/application/nodes', () => {
    test('returns paginated node list', async () => {
      const res = await get('/api/application/nodes', { token: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.object).toBe('list');
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    test('supports ?include=location', async () => {
      const res = await get('/api/application/nodes?include=location', { token: adminToken });
      expect(res.status).toBe(200);
      const node = res.body.data[0];
      expect(node.attributes).toBeDefined();
      expect(node.relationships?.location).toBeDefined();
    });
  });

  describe('GET /api/application/nodes/:id with includes', () => {
    test('supports ?include=location on single node', async () => {
      const listRes = await get('/api/application/nodes', { token: adminToken });
      const nodeId = listRes.body.data[0].attributes.id;

      const res = await get(`/api/application/nodes/${nodeId}?include=location`, { token: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.object).toBe('node');
      expect(res.body.relationships?.location).toBeDefined();
      expect(res.body.relationships.location.object).toBe('location');
    });
  });

  describe('GET /api/application/nodes/:id/configuration', () => {
    test('returns Wings configuration', async () => {
      const listRes = await get('/api/application/nodes', { token: adminToken });
      const nodeId = listRes.body.data[0].attributes.id;

      const res = await get(`/api/application/nodes/${nodeId}/configuration`, { token: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.debug).toBeDefined();
      expect(res.body.api).toBeDefined();
      expect(res.body.remote).toBeDefined();
    });
  });
});
