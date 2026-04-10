import crypto from 'node:crypto';
import { prisma } from '../../prisma/client.js';
import { encrypt } from '../../lib/encryption.js';

const DAEMON_TOKEN_LENGTH = 64;
const DAEMON_TOKEN_ID_LENGTH = 16;

/**
 * Updates a node's configuration.
 * Mirrors app/Services/Nodes/NodeUpdateService.php
 *
 * Note: In the PHP version this also attempts to push the updated config to
 * Wings via DaemonConfigurationRepository. That integration is deferred until
 * the Wings communication layer is implemented. The database update still
 * succeeds even if Wings is unreachable (matches PHP behavior).
 */
export async function updateNode(
  nodeId: number,
  data: Record<string, any>,
  resetToken: boolean = false,
): Promise<any> {
  const updateData: Record<string, any> = { ...data };

  if (resetToken) {
    updateData.daemon_token = encrypt(
      crypto.randomBytes(DAEMON_TOKEN_LENGTH / 2).toString('hex').slice(0, DAEMON_TOKEN_LENGTH),
    );
    updateData.daemon_token_id = crypto
      .randomBytes(DAEMON_TOKEN_ID_LENGTH / 2)
      .toString('hex')
      .slice(0, DAEMON_TOKEN_ID_LENGTH);
  }

  // Remove fields that shouldn't be passed directly to Prisma
  delete updateData.reset_secret;

  const node = await prisma.nodes.update({
    where: { id: nodeId },
    data: updateData,
  });

  return node;
}
