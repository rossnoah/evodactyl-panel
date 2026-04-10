import bcrypt from 'bcryptjs';

/**
 * Hash a password using bcrypt (compatible with Laravel's Hash::make).
 * Laravel uses cost factor 10 by default.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify a password against a bcrypt hash (compatible with Laravel's Hash::check).
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Check if a hash needs rehashing (e.g., cost factor changed).
 */
export function needsRehash(hash: string, rounds: number = 10): boolean {
  const match = hash.match(/^\$2[aby]?\$(\d+)\$/);
  if (!match) return true;
  return parseInt(match[1], 10) !== rounds;
}
