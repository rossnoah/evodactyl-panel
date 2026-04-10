import Hashids from 'hashids';
import { config } from '../config/index.js';

let instance: Hashids | null = null;

function getHashids(): Hashids {
  if (!instance) {
    instance = new Hashids(
      config.hashids.salt,
      config.hashids.length,
      config.hashids.alphabet
    );
  }
  return instance;
}

/**
 * Encode a numeric ID to a hashid string.
 */
export function encodeHashid(id: number): string {
  return getHashids().encode(id);
}

/**
 * Decode a hashid string back to a numeric ID.
 * Returns undefined if the hashid is invalid.
 */
export function decodeHashid(hash: string): number | undefined {
  const decoded = getHashids().decode(hash);
  if (decoded.length === 0) return undefined;
  return decoded[0] as number;
}
