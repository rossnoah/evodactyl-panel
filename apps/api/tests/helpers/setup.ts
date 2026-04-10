/**
 * Test setup and utilities.
 * Provides helpers for creating test fixtures, making authenticated requests,
 * and managing test database state.
 */

import app from '../../src/index.js';
import { prisma } from '../../src/prisma/client.js';
import { encrypt } from '../../src/lib/encryption.js';
import { hashPassword } from '../../src/lib/password.js';
import { generateUuid } from '../../src/lib/uuid.js';
import crypto from 'node:crypto';

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const BASE_URL = `http://localhost:${PORT}`;

let server: ReturnType<typeof app.listen> | null = null;

/** Start the Express server for testing (idempotent) */
export function startServer(): Promise<void> {
  if (server) return Promise.resolve();
  return new Promise((resolve) => {
    server = app.listen(PORT, () => resolve());
  });
}

/** Stop the test server */
export function stopServer(): Promise<void> {
  if (!server) return Promise.resolve();
  return new Promise((resolve) => {
    server!.close(() => resolve());
    server = null;
  });
}

/** Make an HTTP request to the test server */
export async function request(
  method: string,
  path: string,
  options: {
    body?: unknown;
    headers?: Record<string, string>;
    token?: string;
  } = {}
): Promise<{ status: number; body: any; headers: Headers }> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const fetchOptions: RequestInit = { method, headers };
  if (options.body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, fetchOptions);
  let body: any;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    body = await response.json();
  } else {
    body = await response.text();
  }

  return { status: response.status, body, headers: response.headers };
}

/** Shorthand HTTP methods */
export const get = (path: string, opts?: Parameters<typeof request>[2]) => request('GET', path, opts);
export const post = (path: string, opts?: Parameters<typeof request>[2]) => request('POST', path, opts);
export const patch = (path: string, opts?: Parameters<typeof request>[2]) => request('PATCH', path, opts);
export const put = (path: string, opts?: Parameters<typeof request>[2]) => request('PUT', path, opts);
export const del = (path: string, opts?: Parameters<typeof request>[2]) => request('DELETE', path, opts);

/** Create a test user and return the user + a valid API token */
export async function createTestUser(overrides: Partial<{
  email: string;
  username: string;
  root_admin: boolean;
}> = {}): Promise<{ user: any; token: string; identifier: string }> {
  const uuid = generateUuid();
  const identifier = crypto.randomBytes(8).toString('hex'); // 16 chars
  const plainToken = crypto.randomBytes(16).toString('hex'); // 32 chars

  const user = await prisma.users.create({
    data: {
      uuid,
      username: overrides.username ?? `test_${uuid.slice(0, 8)}`,
      email: overrides.email ?? `test_${uuid.slice(0, 8)}@example.com`,
      name_first: 'Test',
      name_last: 'User',
      password: await hashPassword('password'),
      language: 'en',
      root_admin: overrides.root_admin ? 1 : 0,
      use_totp: 0,
    },
  });

  // Create an API key for this user
  await prisma.api_keys.create({
    data: {
      user_id: user.id,
      key_type: 1, // TYPE_ACCOUNT
      identifier,
      token: encrypt(plainToken),
      memo: 'Test API key',
      r_servers: 2,
      r_nodes: 2,
      r_allocations: 2,
      r_users: 2,
      r_locations: 2,
      r_nests: 2,
      r_eggs: 2,
      r_database_hosts: 2,
      r_server_databases: 2,
    },
  });

  return {
    user,
    token: `${identifier}${plainToken}`,
    identifier,
  };
}

/** Create a test admin user */
export async function createTestAdmin(overrides: Partial<{
  email: string;
  username: string;
}> = {}) {
  return createTestUser({ ...overrides, root_admin: true });
}

/** Create a test location */
export async function createTestLocation() {
  return prisma.locations.create({
    data: {
      short: `loc_${crypto.randomBytes(3).toString('hex')}`,
      long: 'Test Location',
    },
  });
}

/** Create a test node */
export async function createTestNode(locationId: number) {
  const uuid = generateUuid();
  const daemonTokenId = crypto.randomBytes(8).toString('hex');
  const daemonToken = crypto.randomBytes(32).toString('hex');

  return prisma.nodes.create({
    data: {
      uuid,
      name: `test-node-${uuid.slice(0, 8)}`,
      location_id: locationId,
      fqdn: `node-${uuid.slice(0, 8)}.test.local`,
      scheme: 'https',
      memory: 8192,
      memory_overallocate: 0,
      disk: 50000,
      disk_overallocate: 0,
      upload_size: 100,
      daemon_token_id: daemonTokenId,
      daemon_token: encrypt(daemonToken),
      daemonListen: 8080,
      daemonSFTP: 2022,
      daemonBase: '/var/lib/pterodactyl/volumes',
      behind_proxy: false,
      maintenance_mode: false,
      public: 1,
    },
  });
}

/** Clean up test data (call in afterAll/afterEach) */
export async function cleanup(): Promise<void> {
  // Delete in order respecting foreign keys
  try {
    await prisma.activity_log_subjects.deleteMany({});
    await prisma.activity_logs.deleteMany({});
    await prisma.audit_logs.deleteMany({});
    await prisma.api_keys.deleteMany({});
    await prisma.subusers.deleteMany({});
    await prisma.backups.deleteMany({});
    await prisma.tasks.deleteMany({});
    await prisma.schedules.deleteMany({});
    await prisma.server_variables.deleteMany({});
    await prisma.databases.deleteMany({});
    await prisma.allocations.deleteMany({ where: { server_id: { not: null } } });
    await prisma.servers.deleteMany({});
    await prisma.allocations.deleteMany({});
    await prisma.egg_variables.deleteMany({});
    await prisma.eggs.deleteMany({});
    await prisma.nests.deleteMany({});
    await prisma.database_hosts.deleteMany({});
    await prisma.nodes.deleteMany({});
    await prisma.locations.deleteMany({});
    await prisma.user_ssh_keys.deleteMany({});
    await prisma.users.deleteMany({});
  } catch (err) {
    console.error('Cleanup error (may be ok):', (err as Error).message);
  }
}
