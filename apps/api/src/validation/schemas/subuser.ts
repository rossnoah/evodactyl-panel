/**
 * Validation schemas for subuser-related requests.
 * Mirrors the Laravel FormRequest validation from:
 * - app/Http/Requests/Api/Client/Servers/Subusers/StoreSubuserRequest.php
 * - app/Http/Requests/Api/Client/Servers/Subusers/UpdateSubuserRequest.php
 */

export interface StoreSubuserInput {
  email: string;
  permissions: string[];
}

export interface UpdateSubuserInput {
  permissions: string[];
}

/**
 * Validate the store subuser request body.
 */
export function validateStoreSubuser(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!body.email || typeof body.email !== 'string') {
    errors.push('The email field is required.');
  } else {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      errors.push('The email must be a valid email address.');
    }
  }

  if (!body.permissions || !Array.isArray(body.permissions)) {
    errors.push('The permissions field is required and must be an array.');
  } else {
    for (const perm of body.permissions) {
      if (typeof perm !== 'string') {
        errors.push('Each permission must be a string.');
        break;
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate the update subuser request body.
 */
export function validateUpdateSubuser(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!body.permissions || !Array.isArray(body.permissions)) {
    errors.push('The permissions field is required and must be an array.');
  } else {
    for (const perm of body.permissions) {
      if (typeof perm !== 'string') {
        errors.push('Each permission must be a string.');
        break;
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
