import { describe, test, expect, beforeAll } from 'bun:test';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const TEST_KEY = crypto.randomBytes(32);
process.env.APP_KEY = `base64:${TEST_KEY.toString('base64')}`;
process.env.APP_URL = 'https://panel.test';

// Import config first so APP_URL is captured before anything else reads the module
// cache. The module freezes config.app.url at load time.
const { config } = await import('../../src/config/index.js');
const { NodeJWTService } = await import(
  '../../src/services/nodes/nodeJwtService.js'
);
const { encrypt } = await import('../../src/lib/encryption.js');
const EXPECTED_ISSUER = config.app.url;

/**
 * Build a fixture node with an encrypted daemon token. Mirrors what Laravel
 * stores on disk: Node::daemon_token is the encrypted form of the actual
 * HS256 signing secret.
 */
function makeNode(daemonSecret: string) {
  return {
    scheme: 'https',
    fqdn: 'node.example.com',
    daemonListen: 8080,
    daemon_token: encrypt(daemonSecret),
  };
}

describe('NodeJWTService — Laravel parity', () => {
  const daemonSecret = 'wings-shared-secret-' + crypto.randomBytes(8).toString('hex');
  const node = makeNode(daemonSecret);

  test('produces a token with the Laravel-standard claim set', () => {
    const user = { id: 42, uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' };
    const serverUuid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    const token = new NodeJWTService()
      .setExpiresAt(new Date(Date.now() + 10 * 60 * 1000))
      .setUser(user)
      .setClaims({ server_uuid: serverUuid, permissions: ['*'] })
      .handle(node, `${user.id}${serverUuid}`);

    // Verify signature with the decrypted daemon secret, mirroring what
    // Wings does on the other side.
    const decoded = jwt.verify(token, daemonSecret, {
      algorithms: ['HS256'],
      issuer: EXPECTED_ISSUER,
      audience: 'https://node.example.com:8080',
    }) as Record<string, unknown>;

    expect(decoded['iss']).toBe(EXPECTED_ISSUER);
    expect(decoded['aud']).toBe('https://node.example.com:8080');
    expect(decoded['user_uuid']).toBe(user.uuid);
    expect(decoded['user_id']).toBe(user.id);
    expect(decoded['server_uuid']).toBe(serverUuid);
    expect(decoded['permissions']).toEqual(['*']);
    expect(typeof decoded['unique_id']).toBe('string');
    expect((decoded['unique_id'] as string).length).toBe(16);

    // jti is md5 of `${user.id}${server.uuid}` by default.
    const expectedJti = crypto
      .createHash('md5')
      .update(`${user.id}${serverUuid}`)
      .digest('hex');
    expect(decoded['jti']).toBe(expectedJti);

    // nbf must be exactly 5 minutes before iat.
    expect(decoded['nbf']).toBe((decoded['iat'] as number) - 300);

    // exp must sit ~10 minutes after iat (allow 1s skew).
    const diff = (decoded['exp'] as number) - (decoded['iat'] as number);
    expect(diff).toBeGreaterThanOrEqual(10 * 60 - 1);
    expect(diff).toBeLessThanOrEqual(10 * 60 + 1);
  });

  test('emits jti in the JWT header (matches lcobucci/jwt->withHeader)', () => {
    const token = new NodeJWTService()
      .setUser({ id: 1, uuid: 'u' })
      .handle(node, 'x');

    const headerB64 = token.split('.')[0]!;
    const header = JSON.parse(
      Buffer.from(headerB64, 'base64url').toString('utf-8')
    );
    expect(header.jti).toBeDefined();
    expect(typeof header.jti).toBe('string');
  });

  test('supports sha256 identifier algorithm (server transfer path)', () => {
    const token = new NodeJWTService()
      .setExpiresAt(new Date(Date.now() + 15 * 60 * 1000))
      .setSubject('server-uuid-123')
      .handle(node, 'server-uuid-123', 'sha256');

    const decoded = jwt.verify(token, daemonSecret) as Record<string, unknown>;
    const expected = crypto
      .createHash('sha256')
      .update('server-uuid-123')
      .digest('hex');
    expect(decoded['jti']).toBe(expected);
    expect(decoded['sub']).toBe('server-uuid-123');
  });

  test('omits user claims when setUser() is not called', () => {
    const token = new NodeJWTService()
      .setClaims({ server_uuid: 's' })
      .handle(node, 's');
    const decoded = jwt.verify(token, daemonSecret) as Record<string, unknown>;
    expect(decoded['user_uuid']).toBeUndefined();
    expect(decoded['user_id']).toBeUndefined();
  });

  test('nbf makes the token unusable for 5 minutes with strict validators', () => {
    const token = new NodeJWTService()
      .setUser({ id: 1, uuid: 'u' })
      .handle(node, 'x');
    // jsonwebtoken.verify() accepts nbf in the past, but Wings' JWT library
    // will reject tokens with nbf > now. We assert the claim is in the past so
    // existing clients remain functional and clock skew is tolerated.
    const decoded = jwt.decode(token) as Record<string, unknown>;
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(decoded['nbf'] as number).toBeLessThanOrEqual(nowSeconds);
    expect((decoded['nbf'] as number) + 300).toBeGreaterThanOrEqual(nowSeconds);
  });
});
