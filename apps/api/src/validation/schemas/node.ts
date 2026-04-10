/**
 * Validation schemas for Node API requests.
 * Mirrors app/Http/Requests/Api/Application/Nodes/StoreNodeRequest.php
 * and app/Models/Node::$validationRules
 */

export interface StoreNodeData {
  name: string;
  location_id: number;
  fqdn: string;
  scheme: string;
  memory: number;
  memory_overallocate: number;
  disk: number;
  disk_overallocate: number;
  daemon_listen: number;
  daemon_sftp: number;
  public?: boolean;
  description?: string | null;
  behind_proxy?: boolean;
  maintenance_mode?: boolean;
  upload_size?: number;
  daemon_base?: string;
}

export interface UpdateNodeData extends Partial<StoreNodeData> {
  reset_secret?: boolean;
}

/**
 * Validate and normalize store node request data.
 * Converts snake_case API fields to the internal column names.
 */
export function validateStoreNode(body: Record<string, any>): StoreNodeData {
  const errors: string[] = [];

  if (!body.name || typeof body.name !== 'string') {
    errors.push('name is required and must be a string.');
  } else if (!/^[\w .\-]{1,100}$/.test(body.name)) {
    errors.push('name must be 1-100 characters and contain only letters, numbers, spaces, dots, and hyphens.');
  }

  if (!body.location_id || typeof body.location_id !== 'number') {
    errors.push('location_id is required and must be a number.');
  }

  if (!body.fqdn || typeof body.fqdn !== 'string') {
    errors.push('fqdn is required and must be a string.');
  }

  if (!body.scheme || typeof body.scheme !== 'string') {
    errors.push('scheme is required (http or https).');
  }

  if (body.memory === undefined || body.memory === null || typeof body.memory !== 'number' || body.memory < 1) {
    errors.push('memory is required and must be at least 1.');
  }

  if (body.memory_overallocate === undefined || typeof body.memory_overallocate !== 'number' || body.memory_overallocate < -1) {
    errors.push('memory_overallocate is required and must be at least -1.');
  }

  if (body.disk === undefined || body.disk === null || typeof body.disk !== 'number' || body.disk < 1) {
    errors.push('disk is required and must be at least 1.');
  }

  if (body.disk_overallocate === undefined || typeof body.disk_overallocate !== 'number' || body.disk_overallocate < -1) {
    errors.push('disk_overallocate is required and must be at least -1.');
  }

  if (body.daemon_listen === undefined || typeof body.daemon_listen !== 'number' || body.daemon_listen < 1 || body.daemon_listen > 65535) {
    errors.push('daemon_listen is required and must be between 1 and 65535.');
  }

  if (body.daemon_sftp === undefined || typeof body.daemon_sftp !== 'number' || body.daemon_sftp < 1 || body.daemon_sftp > 65535) {
    errors.push('daemon_sftp is required and must be between 1 and 65535.');
  }

  if (body.daemon_base !== undefined && typeof body.daemon_base === 'string' && !/^\/[\d\w.\-\/]+$/.test(body.daemon_base)) {
    errors.push('daemon_base must be a valid absolute path.');
  }

  if (body.upload_size !== undefined && (typeof body.upload_size !== 'number' || body.upload_size < 1)) {
    errors.push('upload_size must be at least 1.');
  }

  if (errors.length > 0) {
    const err = new Error(errors.join(' ')) as any;
    err.statusCode = 422;
    throw err;
  }

  return {
    name: body.name,
    location_id: body.location_id,
    fqdn: body.fqdn,
    scheme: body.scheme,
    memory: body.memory,
    memory_overallocate: body.memory_overallocate,
    disk: body.disk,
    disk_overallocate: body.disk_overallocate,
    daemon_listen: body.daemon_listen,
    daemon_sftp: body.daemon_sftp,
    public: body.public,
    description: body.description,
    behind_proxy: body.behind_proxy,
    maintenance_mode: body.maintenance_mode,
    upload_size: body.upload_size,
    daemon_base: body.daemon_base,
  };
}

/**
 * Convert validated API data (snake_case) to internal model column names.
 * Matches the PHP StoreNodeRequest::validated() method.
 */
export function normalizeNodeData(data: StoreNodeData | UpdateNodeData): Record<string, any> {
  const result: Record<string, any> = { ...data };

  // Map snake_case API field names to camelCase column names
  if ('daemon_listen' in result) {
    result.daemonListen = result.daemon_listen;
    delete result.daemon_listen;
  }
  if ('daemon_sftp' in result) {
    result.daemonSFTP = result.daemon_sftp;
    delete result.daemon_sftp;
  }
  if ('daemon_base' in result) {
    result.daemonBase = result.daemon_base ?? '/var/lib/pterodactyl/volumes';
    delete result.daemon_base;
  }

  return result;
}
