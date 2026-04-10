import { decrypt } from './encryption.js';

export interface NodeConnectionFields {
  scheme: string | null;
  fqdn: string;
  daemonListen: number;
  daemon_token: string;
}

/**
 * Build the connection address for a node, matching
 * Laravel's Node::getConnectionAddress().
 */
export function getConnectionAddress(node: NodeConnectionFields): string {
  const scheme = node.scheme || 'https';
  return `${scheme}://${node.fqdn}:${node.daemonListen}`;
}

/**
 * Convert a node's http(s) connection address to its websocket equivalent,
 * matching Laravel's WebsocketController::__invoke() replacement.
 */
export function getWebsocketAddress(node: NodeConnectionFields): string {
  return getConnectionAddress(node)
    .replace(/^https:/, 'wss:')
    .replace(/^http:/, 'ws:');
}

/**
 * Decrypts the node's daemon token. Mirrors Node::getDecryptedKey().
 */
export function getDecryptedKey(node: NodeConnectionFields): string {
  return decrypt(node.daemon_token);
}
