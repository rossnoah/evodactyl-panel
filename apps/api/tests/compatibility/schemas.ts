/**
 * Expected response structures for API endpoints.
 * Derived from PHP Fractal transformers to verify TS compatibility.
 *
 * Each schema defines the `object` type and the expected `attributes` field types
 * that the JSON:API response must contain.
 */

// A field can be a primitive type or a nullable variant
type FieldType = 'string' | 'number' | 'boolean' | 'null' | 'string|null' | 'number|null' | 'boolean|null' | 'object' | 'array';

export interface ObjectSchema {
  object: string; // e.g., 'user', 'server', 'list'
  attributes: Record<string, FieldType>;
  // Optional: expected relationships when ?include= is used
  relationships?: Record<string, { object: string }>;
}

// ---------------------------------------------------------------------------
// Application API schemas
// ---------------------------------------------------------------------------

/** User (Application API) — from UserTransformer */
export const userSchema: ObjectSchema = {
  object: 'user',
  attributes: {
    id: 'number',
    external_id: 'string|null',
    uuid: 'string',
    username: 'string',
    email: 'string',
    first_name: 'string',
    last_name: 'string',
    language: 'string',
    root_admin: 'boolean',
    '2fa': 'boolean',
    created_at: 'string|null',
    updated_at: 'string|null',
  },
};

/** Server (Application API) — from ServerTransformer */
export const serverSchema: ObjectSchema = {
  object: 'server',
  attributes: {
    id: 'number',
    external_id: 'string|null',
    uuid: 'string',
    identifier: 'string',
    name: 'string',
    description: 'string',
    status: 'string|null',
    suspended: 'boolean',
    limits: 'object',
    feature_limits: 'object',
    user: 'number',
    node: 'number',
    allocation: 'number',
    nest: 'number',
    egg: 'number',
    container: 'object',
    updated_at: 'string|null',
    created_at: 'string|null',
  },
};

/** Node (Application API) — from NodeTransformer */
export const nodeSchema: ObjectSchema = {
  object: 'node',
  attributes: {
    id: 'number',
    uuid: 'string',
    public: 'boolean',
    name: 'string',
    description: 'string|null',
    location_id: 'number',
    fqdn: 'string',
    scheme: 'string',
    behind_proxy: 'boolean',
    maintenance_mode: 'boolean',
    memory: 'number',
    memory_overallocate: 'number',
    disk: 'number',
    disk_overallocate: 'number',
    upload_size: 'number',
    daemon_listen: 'number',
    daemon_sftp: 'number',
    daemon_base: 'string',
    created_at: 'string|null',
    updated_at: 'string|null',
    allocated_resources: 'object',
  },
  relationships: {
    allocations: { object: 'list' },
    location: { object: 'location' },
    servers: { object: 'list' },
  },
};

/** Location (Application API) — from LocationTransformer */
export const locationSchema: ObjectSchema = {
  object: 'location',
  attributes: {
    id: 'number',
    short: 'string',
    long: 'string|null',
    updated_at: 'string|null',
    created_at: 'string|null',
  },
  relationships: {
    nodes: { object: 'list' },
    servers: { object: 'list' },
  },
};

/** Nest (Application API) — from NestTransformer */
export const nestSchema: ObjectSchema = {
  object: 'nest',
  attributes: {
    id: 'number',
    uuid: 'string',
    author: 'string',
    name: 'string',
    description: 'string|null',
    created_at: 'string|null',
    updated_at: 'string|null',
  },
  relationships: {
    eggs: { object: 'list' },
    servers: { object: 'list' },
  },
};

/** Allocation (Application API) — from AllocationTransformer */
export const allocationSchema: ObjectSchema = {
  object: 'allocation',
  attributes: {
    id: 'number',
    ip: 'string',
    alias: 'string|null',
    port: 'number',
    notes: 'string|null',
    assigned: 'boolean',
  },
};

/** Egg (Application API) — from EggTransformer */
export const eggSchema: ObjectSchema = {
  object: 'egg',
  attributes: {
    id: 'number',
    uuid: 'string',
    name: 'string',
    nest: 'number',
    author: 'string',
    description: 'string|null',
    docker_image: 'string',
    docker_images: 'object',
    config: 'object',
    startup: 'string',
    script: 'object',
    created_at: 'string|null',
    updated_at: 'string|null',
  },
};

/** Egg Variable (Application API) — from EggVariableTransformer */
export const eggVariableSchema: ObjectSchema = {
  object: 'egg_variable',
  attributes: {
    id: 'number',
    egg_id: 'number',
    name: 'string',
    description: 'string',
    env_variable: 'string',
    default_value: 'string',
    user_viewable: 'boolean',
    user_editable: 'boolean',
    rules: 'string',
    created_at: 'string|null',
    updated_at: 'string|null',
  },
};

/** Database Host (Application API) — from DatabaseHostTransformer */
export const databaseHostSchema: ObjectSchema = {
  object: 'database_host',
  attributes: {
    id: 'number',
    name: 'string',
    host: 'string',
    port: 'number',
    username: 'string',
    node: 'number|null',
    created_at: 'string|null',
    updated_at: 'string|null',
  },
};

/** Server Database (Application API) — from ServerDatabaseTransformer */
export const serverDatabaseSchema: ObjectSchema = {
  object: 'server_database',
  attributes: {
    id: 'number',
    server: 'number',
    host: 'number',
    database: 'string',
    username: 'string',
    remote: 'string',
    max_connections: 'number',
    created_at: 'string|null',
    updated_at: 'string|null',
  },
};

// ---------------------------------------------------------------------------
// Client API schemas
// ---------------------------------------------------------------------------

/** Account (Client API) — from AccountTransformer */
export const accountSchema: ObjectSchema = {
  object: 'user',
  attributes: {
    id: 'number',
    admin: 'boolean',
    username: 'string',
    email: 'string',
    first_name: 'string',
    last_name: 'string',
    language: 'string',
  },
};

/** API Key (Client API) — from ApiKeyTransformer */
export const apiKeySchema: ObjectSchema = {
  object: 'api_key',
  attributes: {
    identifier: 'string',
    description: 'string',
    allowed_ips: 'array',
    last_used_at: 'string|null',
    created_at: 'string|null',
  },
};

/** SSH Key (Client API) — from UserSSHKeyTransformer */
export const sshKeySchema: ObjectSchema = {
  object: 'ssh_key',
  attributes: {
    name: 'string',
    fingerprint: 'string',
    public_key: 'string',
    created_at: 'string|null',
  },
};

/** Activity Log (Client API) — from ActivityLogTransformer */
export const activityLogSchema: ObjectSchema = {
  object: 'activity_log',
  attributes: {
    id: 'string',
    batch: 'string|null',
    event: 'string',
    is_api: 'boolean',
    ip: 'string|null',
    description: 'string|null',
    properties: 'object',
    has_additional_metadata: 'boolean',
    timestamp: 'string|null',
  },
};

/** Backup (Client API) — from BackupTransformer */
export const backupSchema: ObjectSchema = {
  object: 'backup',
  attributes: {
    uuid: 'string',
    is_successful: 'boolean',
    is_locked: 'boolean',
    name: 'string',
    ignored_files: 'array',
    checksum: 'string|null',
    bytes: 'number',
    created_at: 'string|null',
    completed_at: 'string|null',
  },
};

/** Schedule (Client API) — from ScheduleTransformer */
export const scheduleSchema: ObjectSchema = {
  object: 'schedule',
  attributes: {
    id: 'number',
    name: 'string',
    cron: 'object',
    is_active: 'boolean',
    is_processing: 'boolean',
    only_when_online: 'boolean',
    last_run_at: 'string|null',
    next_run_at: 'string|null',
    created_at: 'string|null',
    updated_at: 'string|null',
  },
};

/** Subuser (Client API) — from SubuserTransformer */
export const subuserSchema: ObjectSchema = {
  object: 'subuser',
  attributes: {
    uuid: 'string',
    username: 'string',
    email: 'string',
    image: 'string',
    '2fa_enabled': 'boolean',
    created_at: 'string|null',
    permissions: 'array',
  },
};

// ---------------------------------------------------------------------------
// List wrapper structure
// ---------------------------------------------------------------------------

/**
 * Expected shape for paginated list responses.
 * `object` is 'list', `data` is an array of items, and
 * `meta.pagination` holds standard Fractal pagination fields.
 */
export const listSchema = {
  object: 'list' as const,
  // data: array of items with { object, attributes }
  // meta.pagination: { total, count, per_page, current_page, total_pages, links }
};
