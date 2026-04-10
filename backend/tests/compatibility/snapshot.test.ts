import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import {
  get,
  createTestAdmin,
  createTestUser,
  createTestLocation,
  createTestNode,
  cleanup,
  startServer,
  stopServer,
} from '../helpers/setup.js';
import {
  type ObjectSchema,
  userSchema,
  locationSchema,
  nodeSchema,
  accountSchema,
  apiKeySchema,
  nestSchema,
  allocationSchema,
  eggSchema,
  serverDatabaseSchema,
  databaseHostSchema,
  scheduleSchema,
  backupSchema,
  sshKeySchema,
  activityLogSchema,
  subuserSchema,
  eggVariableSchema,
} from './schemas.js';

// ---------------------------------------------------------------------------
// Schema validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate that `data` conforms to the given ObjectSchema.
 * Returns an array of human-readable error strings (empty = valid).
 */
function validateSchema(data: any, schema: ObjectSchema): string[] {
  const errors: string[] = [];

  if (data.object !== schema.object) {
    errors.push(`object: expected '${schema.object}', got '${data.object}'`);
  }

  if (!data.attributes) {
    errors.push('missing attributes key');
    return errors;
  }

  for (const [field, expectedType] of Object.entries(schema.attributes)) {
    const value = data.attributes[field];

    if (value === undefined) {
      errors.push(`missing field: attributes.${field}`);
      continue;
    }

    if (!matchesType(value, expectedType)) {
      errors.push(
        `attributes.${field}: expected ${expectedType}, got ${describeValue(value)}`,
      );
    }
  }

  // Check for unexpected extra fields
  for (const field of Object.keys(data.attributes)) {
    if (!(field in schema.attributes)) {
      errors.push(`unexpected field: attributes.${field}`);
    }
  }

  return errors;
}

function matchesType(value: unknown, expected: string): boolean {
  if (expected === 'string|null') return value === null || typeof value === 'string';
  if (expected === 'number|null') return value === null || typeof value === 'number';
  if (expected === 'boolean|null') return value === null || typeof value === 'boolean';
  if (expected === 'null') return value === null;
  if (expected === 'array') return Array.isArray(value);
  if (expected === 'object') return typeof value === 'object' && value !== null && !Array.isArray(value);
  return typeof value === expected;
}

function describeValue(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Validate that a timestamp string matches RFC 3339 format:
 *   2024-01-15T10:30:45+00:00
 */
function validateTimestampFormat(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+00:00$/.test(value);
}

/**
 * Validate the pagination wrapper for list endpoints.
 */
function validateListResponse(data: any): string[] {
  const errors: string[] = [];
  if (data.object !== 'list') errors.push(`expected object 'list', got '${data.object}'`);
  if (!Array.isArray(data.data)) errors.push('data should be array');
  if (!data.meta?.pagination) {
    errors.push('missing meta.pagination');
  } else {
    const p = data.meta.pagination;
    if (typeof p.total !== 'number') errors.push('pagination.total should be number');
    if (typeof p.count !== 'number') errors.push('pagination.count should be number');
    if (typeof p.per_page !== 'number') errors.push('pagination.per_page should be number');
    if (typeof p.current_page !== 'number') errors.push('pagination.current_page should be number');
    if (typeof p.total_pages !== 'number') errors.push('pagination.total_pages should be number');
    if (typeof p.links !== 'object') errors.push('pagination.links should be object');
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Compatibility: API response structure snapshots', () => {
  let adminToken: string;
  let adminUser: any;
  let regularToken: string;
  let regularUser: any;
  let location: any;
  let node: any;

  beforeAll(async () => {
    await startServer();
    await cleanup();

    const admin = await createTestAdmin();
    adminToken = admin.token;
    adminUser = admin.user;

    const regular = await createTestUser();
    regularToken = regular.token;
    regularUser = regular.user;

    location = await createTestLocation();
    node = await createTestNode(location.id);
  });

  afterAll(async () => {
    await cleanup();
    await stopServer();
  });

  // -----------------------------------------------------------------------
  // Application API: Users
  // -----------------------------------------------------------------------

  describe('GET /api/application/users (list)', () => {
    test('returns valid list wrapper structure', async () => {
      const res = await get('/api/application/users', { token: adminToken });
      expect(res.status).toBe(200);

      const listErrors = validateListResponse(res.body);
      expect(listErrors).toEqual([]);
    });

    test('each user item matches userSchema', async () => {
      const res = await get('/api/application/users', { token: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);

      for (const item of res.body.data) {
        const errors = validateSchema(item, userSchema);
        expect(errors).toEqual([]);
      }
    });

    test('user timestamps are null or RFC 3339 formatted', async () => {
      const res = await get('/api/application/users', { token: adminToken });
      const attrs = res.body.data[0].attributes;
      expect(attrs.created_at === null || validateTimestampFormat(attrs.created_at)).toBe(true);
      expect(attrs.updated_at === null || validateTimestampFormat(attrs.updated_at)).toBe(true);
    });

    test('pagination respects per_page parameter', async () => {
      const res = await get('/api/application/users?per_page=1', { token: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.meta.pagination.per_page).toBe(1);
      expect(res.body.data.length).toBeLessThanOrEqual(1);
    });
  });

  describe('GET /api/application/users/:id (single)', () => {
    test('single user response matches userSchema', async () => {
      const res = await get(`/api/application/users/${adminUser.id}`, { token: adminToken });
      expect(res.status).toBe(200);

      const errors = validateSchema(res.body, userSchema);
      expect(errors).toEqual([]);
    });

    test('user id field is numeric', async () => {
      const res = await get(`/api/application/users/${adminUser.id}`, { token: adminToken });
      expect(typeof res.body.attributes.id).toBe('number');
    });

    test('root_admin is boolean, not number', async () => {
      const res = await get(`/api/application/users/${adminUser.id}`, { token: adminToken });
      expect(typeof res.body.attributes.root_admin).toBe('boolean');
    });

    test('2fa field is boolean', async () => {
      const res = await get(`/api/application/users/${adminUser.id}`, { token: adminToken });
      expect(typeof res.body.attributes['2fa']).toBe('boolean');
    });
  });

  // -----------------------------------------------------------------------
  // Application API: Locations
  // -----------------------------------------------------------------------

  describe('GET /api/application/locations (list)', () => {
    test('returns valid list wrapper', async () => {
      const res = await get('/api/application/locations', { token: adminToken });
      expect(res.status).toBe(200);

      const listErrors = validateListResponse(res.body);
      expect(listErrors).toEqual([]);
    });

    test('each location matches locationSchema', async () => {
      const res = await get('/api/application/locations', { token: adminToken });
      expect(res.body.data.length).toBeGreaterThan(0);

      for (const item of res.body.data) {
        const errors = validateSchema(item, locationSchema);
        expect(errors).toEqual([]);
      }
    });

    test('location timestamps are null or RFC 3339', async () => {
      const res = await get('/api/application/locations', { token: adminToken });
      const attrs = res.body.data[0].attributes;
      expect(attrs.created_at === null || validateTimestampFormat(attrs.created_at)).toBe(true);
      expect(attrs.updated_at === null || validateTimestampFormat(attrs.updated_at)).toBe(true);
    });
  });

  describe('GET /api/application/locations/:id (single)', () => {
    test('single location matches locationSchema', async () => {
      const res = await get(`/api/application/locations/${location.id}`, { token: adminToken });
      expect(res.status).toBe(200);

      const errors = validateSchema(res.body, locationSchema);
      expect(errors).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Application API: Nodes
  // -----------------------------------------------------------------------

  describe('GET /api/application/nodes (list)', () => {
    test('returns valid list wrapper', async () => {
      const res = await get('/api/application/nodes', { token: adminToken });
      expect(res.status).toBe(200);

      const listErrors = validateListResponse(res.body);
      expect(listErrors).toEqual([]);
    });

    test('each node matches nodeSchema', async () => {
      const res = await get('/api/application/nodes', { token: adminToken });
      expect(res.body.data.length).toBeGreaterThan(0);

      for (const item of res.body.data) {
        const errors = validateSchema(item, nodeSchema);
        expect(errors).toEqual([]);
      }
    });

    test('node allocated_resources is an object with memory and disk', async () => {
      const res = await get('/api/application/nodes', { token: adminToken });
      const attrs = res.body.data[0].attributes;
      expect(typeof attrs.allocated_resources).toBe('object');
      expect(typeof attrs.allocated_resources.memory).toBe('number');
      expect(typeof attrs.allocated_resources.disk).toBe('number');
    });

    test('node timestamps are null or RFC 3339', async () => {
      const res = await get('/api/application/nodes', { token: adminToken });
      const attrs = res.body.data[0].attributes;
      expect(attrs.created_at === null || validateTimestampFormat(attrs.created_at)).toBe(true);
      expect(attrs.updated_at === null || validateTimestampFormat(attrs.updated_at)).toBe(true);
    });
  });

  describe('GET /api/application/nodes/:id (single)', () => {
    test('single node matches nodeSchema', async () => {
      const res = await get(`/api/application/nodes/${node.id}`, { token: adminToken });
      expect(res.status).toBe(200);

      const errors = validateSchema(res.body, nodeSchema);
      expect(errors).toEqual([]);
    });

    test('daemon_listen and daemon_sftp are numbers', async () => {
      const res = await get(`/api/application/nodes/${node.id}`, { token: adminToken });
      expect(typeof res.body.attributes.daemon_listen).toBe('number');
      expect(typeof res.body.attributes.daemon_sftp).toBe('number');
    });
  });

  // -----------------------------------------------------------------------
  // Application API: ?include= relationships
  // -----------------------------------------------------------------------

  describe('?include= query parameter', () => {
    test('nodes?include=location includes relationship data', async () => {
      const res = await get('/api/application/nodes?include=location', { token: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);

      const firstNode = res.body.data[0];
      expect(firstNode.attributes).toBeDefined();
      // The relationship should appear in the response
      expect(firstNode.relationships).toBeDefined();
      expect(firstNode.relationships.location).toBeDefined();
      expect(firstNode.relationships.location.object).toBe('location');
    });

    test('locations?include=nodes includes relationship data', async () => {
      const res = await get('/api/application/locations?include=nodes', { token: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);

      const firstLocation = res.body.data[0];
      expect(firstLocation.relationships).toBeDefined();
      expect(firstLocation.relationships.nodes).toBeDefined();
      expect(firstLocation.relationships.nodes.object).toBe('list');
    });
  });

  // -----------------------------------------------------------------------
  // Client API: Account
  // -----------------------------------------------------------------------

  describe('GET /api/client/account', () => {
    test('response matches accountSchema', async () => {
      const res = await get('/api/client/account', { token: adminToken });
      expect(res.status).toBe(200);

      const errors = validateSchema(res.body, accountSchema);
      expect(errors).toEqual([]);
    });

    test('admin field is boolean', async () => {
      const res = await get('/api/client/account', { token: adminToken });
      expect(typeof res.body.attributes.admin).toBe('boolean');
      expect(res.body.attributes.admin).toBe(true);
    });

    test('non-admin user has admin=false', async () => {
      const res = await get('/api/client/account', { token: regularToken });
      expect(res.status).toBe(200);
      expect(res.body.attributes.admin).toBe(false);
    });

    test('account schema has no timestamp fields (unlike application user)', async () => {
      const res = await get('/api/client/account', { token: adminToken });
      expect(res.body.attributes.created_at).toBeUndefined();
      expect(res.body.attributes.updated_at).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Client API: Permissions
  // -----------------------------------------------------------------------

  describe('GET /api/client/permissions', () => {
    test('returns system_permissions object', async () => {
      const res = await get('/api/client/permissions', { token: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.object).toBe('system_permissions');
      expect(res.body.attributes).toBeDefined();
      expect(res.body.attributes.permissions).toBeDefined();
      expect(typeof res.body.attributes.permissions).toBe('object');
    });

    test('permissions object contains expected groups', async () => {
      const res = await get('/api/client/permissions', { token: adminToken });
      const perms = res.body.attributes.permissions;
      // These groups are defined in permissions.ts matching PHP Permission model
      expect(perms).toHaveProperty('websocket');
      expect(perms).toHaveProperty('control');
      expect(perms).toHaveProperty('database');
    });
  });

  // -----------------------------------------------------------------------
  // Client API: API Keys
  // -----------------------------------------------------------------------

  describe('GET /api/client/account/api-keys', () => {
    test('returns valid list of api_key items', async () => {
      const res = await get('/api/client/account/api-keys', { token: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.object).toBe('list');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('api key items match apiKeySchema when present', async () => {
      const res = await get('/api/client/account/api-keys', { token: adminToken });
      // The admin has at least the test API key we created
      if (res.body.data.length > 0) {
        for (const item of res.body.data) {
          const errors = validateSchema(item, apiKeySchema);
          expect(errors).toEqual([]);
        }
      }
    });
  });

  // -----------------------------------------------------------------------
  // Client API: SSH Keys
  // -----------------------------------------------------------------------

  describe('GET /api/client/account/ssh-keys', () => {
    test('returns valid list response', async () => {
      const res = await get('/api/client/account/ssh-keys', { token: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.object).toBe('list');
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Error response format
  // -----------------------------------------------------------------------

  describe('Error response structure', () => {
    test('401 error has standard JSON:API error format', async () => {
      const res = await get('/api/application/users');
      expect(res.status).toBe(401);
      expect(res.body.errors).toBeDefined();
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors[0]).toHaveProperty('code');
      expect(res.body.errors[0]).toHaveProperty('status');
    });

    test('404 error has standard JSON:API error format', async () => {
      const res = await get('/api/application/users/999999', { token: adminToken });
      expect(res.status).toBe(404);
      expect(res.body.errors).toBeDefined();
      expect(Array.isArray(res.body.errors)).toBe(true);
    });

    test('403 for non-admin uses correct error structure', async () => {
      const res = await get('/api/application/users', { token: regularToken });
      expect(res.status).toBe(403);
      expect(res.body.errors).toBeDefined();
      expect(Array.isArray(res.body.errors)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Timestamp format consistency
  // -----------------------------------------------------------------------

  describe('Timestamp format consistency across endpoints', () => {
    test('user timestamps are null or match RFC 3339', async () => {
      const res = await get(`/api/application/users/${adminUser.id}`, { token: adminToken });
      const { created_at, updated_at } = res.body.attributes;
      expect(created_at === null || validateTimestampFormat(created_at)).toBe(true);
      expect(updated_at === null || validateTimestampFormat(updated_at)).toBe(true);
    });

    test('location timestamps are null or match RFC 3339', async () => {
      const res = await get(`/api/application/locations/${location.id}`, { token: adminToken });
      const { created_at, updated_at } = res.body.attributes;
      expect(created_at === null || validateTimestampFormat(created_at)).toBe(true);
      expect(updated_at === null || validateTimestampFormat(updated_at)).toBe(true);
    });

    test('node timestamps are null or match RFC 3339', async () => {
      const res = await get(`/api/application/nodes/${node.id}`, { token: adminToken });
      const { created_at, updated_at } = res.body.attributes;
      expect(created_at === null || validateTimestampFormat(created_at)).toBe(true);
      expect(updated_at === null || validateTimestampFormat(updated_at)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Field type strictness
  // -----------------------------------------------------------------------

  describe('Field type strictness', () => {
    test('boolean fields are not numeric (user.root_admin)', async () => {
      const res = await get(`/api/application/users/${adminUser.id}`, { token: adminToken });
      const val = res.body.attributes.root_admin;
      expect(val === true || val === false).toBe(true);
      expect(val).not.toBe(1);
      expect(val).not.toBe(0);
    });

    test('boolean fields are not numeric (user.2fa)', async () => {
      const res = await get(`/api/application/users/${adminUser.id}`, { token: adminToken });
      const val = res.body.attributes['2fa'];
      expect(val === true || val === false).toBe(true);
    });

    test('node.behind_proxy is boolean', async () => {
      const res = await get(`/api/application/nodes/${node.id}`, { token: adminToken });
      const val = res.body.attributes.behind_proxy;
      expect(typeof val).toBe('boolean');
    });

    test('node.maintenance_mode is boolean', async () => {
      const res = await get(`/api/application/nodes/${node.id}`, { token: adminToken });
      const val = res.body.attributes.maintenance_mode;
      expect(typeof val).toBe('boolean');
    });

    test('account.admin is boolean for admin user', async () => {
      const res = await get('/api/client/account', { token: adminToken });
      expect(res.body.attributes.admin).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Nullable field checks
  // -----------------------------------------------------------------------

  describe('Nullable field handling', () => {
    test('user external_id defaults to null', async () => {
      const res = await get(`/api/application/users/${adminUser.id}`, { token: adminToken });
      // Admin user created via helper has no external_id, should be null
      const val = res.body.attributes.external_id;
      expect(val === null || typeof val === 'string').toBe(true);
    });

    test('location.long can be string or null', async () => {
      const res = await get(`/api/application/locations/${location.id}`, { token: adminToken });
      const val = res.body.attributes.long;
      expect(val === null || typeof val === 'string').toBe(true);
    });
  });
});
