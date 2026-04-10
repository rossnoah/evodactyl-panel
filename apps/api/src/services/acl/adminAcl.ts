/**
 * AdminAcl — Application API key permission checking.
 * Mirrors app/Services/Acl/Api/AdminAcl.php
 */

export const COLUMN_IDENTIFIER = 'r_';

export const NONE = 0;
export const READ = 1;
export const WRITE = 2;

export const RESOURCE_SERVERS = 'servers';
export const RESOURCE_NODES = 'nodes';
export const RESOURCE_ALLOCATIONS = 'allocations';
export const RESOURCE_USERS = 'users';
export const RESOURCE_LOCATIONS = 'locations';
export const RESOURCE_NESTS = 'nests';
export const RESOURCE_EGGS = 'eggs';
export const RESOURCE_DATABASE_HOSTS = 'database_hosts';
export const RESOURCE_SERVER_DATABASES = 'server_databases';

/**
 * Determine if a permission value allows a specific action level.
 */
export function can(permission: number, action: number = READ): boolean {
  return (permission & action) !== 0;
}

/**
 * Check if an API key has permission for a resource at a given action level.
 */
export function check(apiKey: Record<string, unknown>, resource: string, action: number = READ): boolean {
  const columnName = `${COLUMN_IDENTIFIER}${resource}`;
  const permission = (apiKey[columnName] as number) ?? NONE;
  return can(permission, action);
}

/**
 * All available resource names.
 */
export const resourceList = [
  RESOURCE_SERVERS,
  RESOURCE_NODES,
  RESOURCE_ALLOCATIONS,
  RESOURCE_USERS,
  RESOURCE_LOCATIONS,
  RESOURCE_NESTS,
  RESOURCE_EGGS,
  RESOURCE_DATABASE_HOSTS,
  RESOURCE_SERVER_DATABASES,
];
