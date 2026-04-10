import crypto from 'node:crypto';
import { prisma } from '../../prisma/client.js';
import { generateUuid } from '../../lib/uuid.js';
import { encrypt } from '../../lib/encryption.js';

const DAEMON_TOKEN_LENGTH = 64;
const DAEMON_TOKEN_ID_LENGTH = 16;

/**
 * Creates a new node on the panel.
 * Mirrors app/Services/Nodes/NodeCreationService.php
 */
export async function createNode(data: Record<string, any>): Promise<any> {
  const uuid = generateUuid();
  const daemonTokenId = crypto.randomBytes(DAEMON_TOKEN_ID_LENGTH / 2).toString('hex').slice(0, DAEMON_TOKEN_ID_LENGTH);
  const daemonToken = encrypt(crypto.randomBytes(DAEMON_TOKEN_LENGTH / 2).toString('hex').slice(0, DAEMON_TOKEN_LENGTH));

  const node = await prisma.nodes.create({
    data: {
      uuid,
      daemon_token_id: daemonTokenId,
      daemon_token: daemonToken,
      public: data.public ?? 1,
      name: data.name,
      description: data.description ?? null,
      location_id: data.location_id,
      fqdn: data.fqdn,
      scheme: data.scheme ?? 'https',
      behind_proxy: data.behind_proxy ?? false,
      maintenance_mode: data.maintenance_mode ?? false,
      memory: data.memory,
      memory_overallocate: data.memory_overallocate ?? 0,
      disk: data.disk,
      disk_overallocate: data.disk_overallocate ?? 0,
      upload_size: data.upload_size ?? 100,
      daemonListen: data.daemonListen ?? 8080,
      daemonSFTP: data.daemonSFTP ?? 2022,
      daemonBase: data.daemonBase ?? '/var/lib/pterodactyl/volumes',
    },
  });

  return node;
}
