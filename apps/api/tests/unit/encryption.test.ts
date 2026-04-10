import { describe, test, expect, beforeAll } from 'bun:test';
import crypto from 'node:crypto';

// Set APP_KEY before importing the encrypter (module reads config at call time, but
// we need APP_KEY in the env for both the module under test and the hand-built fixture).
const TEST_KEY = crypto.randomBytes(32);
const APP_KEY = `base64:${TEST_KEY.toString('base64')}`;
process.env.APP_KEY = APP_KEY;

const { encrypt, decrypt } = await import('../../src/lib/encryption.js');

/**
 * Reproduces Laravel's Illuminate\Encryption\Encrypter::encryptString() format
 * so we can verify our TS implementation is byte-compatible with what PHP emits.
 *
 * Laravel format: base64(json({ iv, value, mac, tag: "" }))
 *   - key:   32 raw bytes decoded from APP_KEY (base64:... prefix stripped)
 *   - iv:    16 random bytes, base64-encoded
 *   - value: AES-256-CBC ciphertext of PHP-serialized plaintext, base64-encoded
 *   - mac:   sha256 hmac of (iv || value) keyed with the raw key, hex-encoded
 *   - tag:   empty string (AEAD tag slot, only used for GCM which Laravel does not use)
 */
function buildLaravelEnvelope(plaintext: string, keyRaw: Buffer): string {
  const iv = crypto.randomBytes(16);
  const serialized = `s:${Buffer.byteLength(plaintext)}:"${plaintext}";`;
  const cipher = crypto.createCipheriv('aes-256-cbc', keyRaw, iv);
  let value = cipher.update(serialized, 'utf8', 'base64');
  value += cipher.final('base64');
  const ivBase64 = iv.toString('base64');
  const mac = crypto
    .createHmac('sha256', keyRaw)
    .update(ivBase64 + value)
    .digest('hex');
  const payload = { iv: ivBase64, value, mac, tag: '' };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

describe('Laravel encrypter parity', () => {
  test('round-trips a plain ASCII string', () => {
    const plaintext = 'hello-world';
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  test('round-trips a unicode string', () => {
    const plaintext = 'héllo 世界 🎉';
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  test('round-trips an empty string', () => {
    expect(decrypt(encrypt(''))).toBe('');
  });

  test('decrypts a hand-built Laravel-format envelope', () => {
    const plaintext = 'wings-daemon-secret-token';
    const envelope = buildLaravelEnvelope(plaintext, TEST_KEY);
    expect(decrypt(envelope)).toBe(plaintext);
  });

  test('decrypts envelopes produced by our encrypt() with a fresh key derivation', () => {
    // Covers the common case: a secret stored once, read many times.
    const plaintext = 'some-long-secret-' + crypto.randomBytes(8).toString('hex');
    const envelope = encrypt(plaintext);
    // Envelope must be valid base64-encoded JSON with the expected keys.
    const parsed = JSON.parse(Buffer.from(envelope, 'base64').toString('utf-8'));
    expect(parsed).toHaveProperty('iv');
    expect(parsed).toHaveProperty('value');
    expect(parsed).toHaveProperty('mac');
    expect(parsed).toHaveProperty('tag');
    expect(parsed.tag).toBe('');
    expect(decrypt(envelope)).toBe(plaintext);
  });

  test('rejects a tampered MAC', () => {
    const envelope = encrypt('sensitive');
    const parsed = JSON.parse(Buffer.from(envelope, 'base64').toString('utf-8'));
    parsed.mac =
      '0000000000000000000000000000000000000000000000000000000000000000';
    const tampered = Buffer.from(JSON.stringify(parsed)).toString('base64');
    expect(() => decrypt(tampered)).toThrow();
  });

  test('rejects an envelope missing required fields', () => {
    const bad = Buffer.from(JSON.stringify({ iv: '', value: '' })).toString(
      'base64'
    );
    expect(() => decrypt(bad)).toThrow();
  });
});
