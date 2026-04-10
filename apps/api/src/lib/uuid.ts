import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a new UUID v4 string.
 */
export function generateUuid(): string {
  return uuidv4();
}

/**
 * Generate a short UUID (first 8 characters, no hyphens).
 * Used by Pterodactyl for server uuidShort.
 */
export function generateShortUuid(): string {
  return uuidv4().replace(/-/g, '').substring(0, 8);
}
