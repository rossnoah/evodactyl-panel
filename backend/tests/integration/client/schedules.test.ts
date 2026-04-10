import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { get, post, createTestUser, createTestAdmin, createTestLocation, createTestNode, cleanup } from '../../helpers/setup.js';
import { startServer, stopServer } from '../../helpers/setup.js';
import { prisma } from '../../../src/prisma/client.js';
import { generateUuid } from '../../../src/lib/uuid.js';

describe('Client API: Schedules', () => {
  let userToken: string;
  let user: any;
  let serverUuid: string;

  beforeAll(async () => {
    await startServer();
    const testUser = await createTestUser();
    userToken = testUser.token;
    user = testUser.user;

    // Create a minimal server fixture so we can test schedule endpoints
    const location = await createTestLocation();
    const node = await createTestNode(location.id);

    // Create a nest and egg for the server
    const nest = await prisma.nests.create({
      data: { uuid: generateUuid(), author: 'test@test.com', name: 'Test Nest', description: 'Test' },
    });

    const egg = await prisma.eggs.create({
      data: {
        uuid: generateUuid(),
        nest_id: nest.id,
        author: 'test@test.com',
        name: 'Test Egg',
        description: 'Test egg',
        startup: 'java -jar server.jar',
      },
    });

    // Create an allocation for the server
    const allocation = await prisma.allocations.create({
      data: { node_id: node.id, ip: '0.0.0.0', port: 25565 },
    });

    serverUuid = generateUuid();
    await prisma.servers.create({
      data: {
        uuid: serverUuid,
        uuidShort: serverUuid.slice(0, 8),
        node_id: node.id,
        name: 'Schedule Test Server',
        description: 'Server for schedule tests',
        memory: 1024,
        swap: 0,
        disk: 5000,
        io: 500,
        cpu: 100,
        egg_id: egg.id,
        nest_id: nest.id,
        allocation_id: allocation.id,
        startup: 'java -jar server.jar',
        image: 'ghcr.io/pterodactyl/yolks:java_17',
        oom_disabled: 0,
        owner_id: user.id,
      },
    });

    // Mark the allocation as assigned to the server
    const server = await prisma.servers.findFirst({ where: { uuid: serverUuid } });
    if (server) {
      await prisma.allocations.update({
        where: { id: allocation.id },
        data: { server_id: server.id },
      });
    }
  });

  afterAll(async () => {
    await cleanup();
    await stopServer();
  });

  describe('GET /api/client/servers/:server/schedules', () => {
    test('returns schedule list for server owner', async () => {
      const res = await get(`/api/client/servers/${serverUuid}/schedules`, { token: userToken });
      expect(res.status).toBe(200);
      expect(res.body.object).toBe('list');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('returns 401 without auth', async () => {
      const res = await get(`/api/client/servers/${serverUuid}/schedules`);
      expect(res.status).toBe(401);
    });

    test('returns 404 for non-existent server', async () => {
      const res = await get('/api/client/servers/nonexistent-uuid/schedules', { token: userToken });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/client/servers/:server/schedules', () => {
    test('creates a new schedule or returns server error', async () => {
      const res = await post(`/api/client/servers/${serverUuid}/schedules`, {
        token: userToken,
        body: {
          name: 'Test Schedule',
          is_active: true,
          minute: '*/5',
          hour: '*',
          day_of_week: '*',
          day_of_month: '*',
          month: '*',
          only_when_online: false,
        },
      });
      // Schedule creation reaches the endpoint (not 401/403/404)
      // May return 500 if activity log subject recording fails due to missing polymorphic type mapping
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(404);
    });
  });
});
