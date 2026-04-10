import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { get, post, patch, del, createTestAdmin, cleanup } from '../../helpers/setup.js';
import { startServer, stopServer } from '../../helpers/setup.js';

describe('Application API: Locations', () => {
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

  test('CRUD lifecycle', async () => {
    // Create
    const createRes = await post('/api/application/locations', {
      token: adminToken,
      body: { short: 'us-east', long: 'US East Coast' },
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.object).toBe('location');
    const id = createRes.body.attributes.id;

    // Read
    const readRes = await get(`/api/application/locations/${id}`, { token: adminToken });
    expect(readRes.status).toBe(200);
    expect(readRes.body.attributes.short).toBe('us-east');

    // Update
    const updateRes = await patch(`/api/application/locations/${id}`, {
      token: adminToken,
      body: { long: 'US East Coast (Updated)' },
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.attributes.long).toBe('US East Coast (Updated)');

    // List
    const listRes = await get('/api/application/locations', { token: adminToken });
    expect(listRes.status).toBe(200);
    expect(listRes.body.object).toBe('list');

    // Delete
    const deleteRes = await del(`/api/application/locations/${id}`, { token: adminToken });
    expect(deleteRes.status).toBe(204);

    // Verify gone
    const goneRes = await get(`/api/application/locations/${id}`, { token: adminToken });
    expect(goneRes.status).toBe(404);
  });
});
