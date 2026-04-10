import { parse as uuidParse } from 'uuid';

const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

/**
 * Encode a Uint8Array as RFC 4648 Base32, lowercase, without padding.
 * Mirrors ParagonIE\ConstantTime\Base32::encodeUnpadded() from PHP.
 */
function base32EncodeUnpadded(bytes: Uint8Array): string {
  let result = '';
  let bits = 0;
  let value = 0;

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      bits -= 5;
      result += BASE32_ALPHABET[(value >>> bits) & 0x1f];
    }
  }

  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }

  return result;
}

/**
 * Generate a realtime identifier for a model, matching PHP's HasRealtimeIdentifier trait.
 *
 * Format: `{prefix}_{base32(uuid_bytes)}`
 *
 * Example: serv_tgmztgmztgmztgmztgmztgmzte
 */
export function makeIdentifier(prefix: string, uuid: string): string {
  try {
    const bytes = uuidParse(uuid);
    const encoded = base32EncodeUnpadded(new Uint8Array(bytes));
    return `${prefix}_${encoded}`;
  } catch {
    // Fallback for non-RFC4122 UUIDs: encode the hex bytes directly
    const hex = uuid.replace(/-/g, '');
    const bytes = new Uint8Array(hex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
    const encoded = base32EncodeUnpadded(bytes);
    return `${prefix}_${encoded}`;
  }
}

/**
 * Generate a server identifier from a UUID.
 * Mirrors PHP: #[Identifiable('serv')] on Server model.
 */
export function serverIdentifier(uuid: string): string {
  return makeIdentifier('serv', uuid);
}
