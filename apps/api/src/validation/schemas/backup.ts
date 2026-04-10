/**
 * Validation schemas for backup-related requests.
 * Mirrors the Laravel FormRequest validation from:
 * - app/Http/Requests/Api/Client/Servers/Backups/StoreBackupRequest.php
 * - app/Http/Requests/Api/Client/Servers/Backups/RestoreBackupRequest.php
 */

export interface StoreBackupInput {
  name?: string;
  ignored?: string;
  is_locked?: boolean;
}

export interface RestoreBackupInput {
  truncate?: boolean;
}

/**
 * Validate the store backup request body.
 */
export function validateStoreBackup(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (body.name !== undefined && body.name !== null) {
    if (typeof body.name !== 'string') {
      errors.push('The name must be a string.');
    } else if (body.name.length > 191) {
      errors.push('The name may not be greater than 191 characters.');
    }
  }

  if (body.ignored !== undefined && body.ignored !== null) {
    if (typeof body.ignored !== 'string') {
      errors.push('The ignored field must be a string.');
    }
  }

  if (body.is_locked !== undefined && body.is_locked !== null) {
    if (typeof body.is_locked !== 'boolean') {
      errors.push('The is_locked field must be a boolean.');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate the restore backup request body.
 */
export function validateRestoreBackup(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (body.truncate !== undefined && body.truncate !== null) {
    if (typeof body.truncate !== 'boolean') {
      errors.push('The truncate field must be a boolean.');
    }
  }

  return { valid: errors.length === 0, errors };
}
