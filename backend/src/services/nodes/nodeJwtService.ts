import { signJwt } from '../../lib/jwt.js';
import { decrypt } from '../../lib/encryption.js';

/**
 * Generate JWT tokens for Wings daemon WebSocket connections.
 * Mirrors app/Services/Nodes/NodeJWTService.php
 */

interface WebSocketJwtPayload {
  user_uuid: string;
  server_uuid: string;
  permissions: string[];
}

/**
 * Generate a signed JWT for WebSocket authentication with a Wings daemon.
 *
 * @param node - The node the server is on
 * @param user - The requesting user
 * @param serverUuid - The server's UUID
 * @param permissions - Array of permission strings the user has
 * @param expiresInMinutes - Token expiry (default 10 minutes)
 */
export function generateWebSocketToken(
  node: { daemon_token: string },
  user: { uuid: string },
  serverUuid: string,
  permissions: string[],
  expiresInMinutes: number = 10
): { token: string; socket: string } {
  const secret = decrypt(node.daemon_token);

  const payload: WebSocketJwtPayload = {
    user_uuid: user.uuid,
    server_uuid: serverUuid,
    permissions,
  };

  const token = signJwt(payload, secret, {
    expiresIn: `${expiresInMinutes}m`,
    issuer: 'Pterodactyl Panel',
  });

  return {
    token,
    socket: `wss://${(node as any).fqdn}:${(node as any).daemonListen}/api/servers/${serverUuid}/ws`,
  };
}
