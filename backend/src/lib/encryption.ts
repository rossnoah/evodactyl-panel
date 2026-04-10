import crypto from 'node:crypto';
import { config } from '../config/index.js';

/**
 * Laravel-compatible AES-256-CBC encryption/decryption.
 *
 * Laravel's Encrypter stores encrypted values as base64-encoded JSON with the structure:
 * { iv: string, value: string, mac: string, tag: string }
 *
 * The APP_KEY is base64-encoded and prefixed with "base64:".
 */

function getKey(): Buffer {
  const appKey = config.app.key;
  if (!appKey) {
    throw new Error('APP_KEY is not set. Cannot perform encryption/decryption.');
  }
  if (appKey.startsWith('base64:')) {
    return Buffer.from(appKey.slice(7), 'base64');
  }
  return Buffer.from(appKey);
}

interface LaravelEncryptedPayload {
  iv: string;
  value: string;
  mac: string;
  tag: string;
}

function calculateMac(iv: string, value: string, key: Buffer): string {
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(iv + value);
  return hmac.digest('hex');
}

function validMac(payload: LaravelEncryptedPayload, key: Buffer): boolean {
  const calculated = calculateMac(payload.iv, payload.value, key);
  return crypto.timingSafeEqual(
    Buffer.from(calculated, 'hex'),
    Buffer.from(payload.mac, 'hex')
  );
}

/**
 * Decrypt a value encrypted by Laravel's Encrypter (AES-256-CBC).
 */
export function decrypt(encryptedValue: string): string {
  const key = getKey();
  const payload: LaravelEncryptedPayload = JSON.parse(
    Buffer.from(encryptedValue, 'base64').toString('utf-8')
  );

  if (!payload.iv || !payload.value || !payload.mac) {
    throw new Error('Invalid encrypted payload structure.');
  }

  if (!validMac(payload, key)) {
    throw new Error('MAC verification failed. The payload may have been tampered with.');
  }

  const iv = Buffer.from(payload.iv, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(payload.value, 'base64', 'utf-8');
  decrypted += decipher.final('utf-8');

  // Laravel serializes values with PHP's serialize() — handle both serialized and raw strings
  // PHP serialized strings look like: s:5:"hello";
  const serializedMatch = decrypted.match(/^s:\d+:"(.*)";$/s);
  if (serializedMatch) {
    return serializedMatch[1];
  }

  return decrypted;
}

/**
 * Encrypt a value using Laravel-compatible AES-256-CBC encryption.
 */
export function encrypt(value: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(16);

  // Laravel serializes values with PHP's serialize()
  const serialized = `s:${Buffer.byteLength(value)}:"${value}";`;

  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(serialized, 'utf-8', 'base64');
  encrypted += cipher.final('base64');

  const ivBase64 = iv.toString('base64');
  const mac = calculateMac(ivBase64, encrypted, key);

  const payload: LaravelEncryptedPayload = {
    iv: ivBase64,
    value: encrypted,
    mac,
    tag: '',
  };

  return Buffer.from(JSON.stringify(payload)).toString('base64');
}
