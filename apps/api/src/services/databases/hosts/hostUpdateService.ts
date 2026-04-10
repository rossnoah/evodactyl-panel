import mysql from 'mysql2/promise';
import { prisma } from '../../../prisma/client.js';
import { encrypt, decrypt } from '../../../lib/encryption.js';
import { DisplayException } from '../../../errors/index.js';

/**
 * Update an existing database host and verify connectivity.
 * Mirrors app/Services/Databases/Hosts/HostUpdateService.php
 */
export async function updateDatabaseHost(hostId: number, data: {
  name?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  node_id?: number | null;
}) {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.host !== undefined) updateData.host = data.host;
  if (data.port !== undefined) updateData.port = data.port;
  if (data.username !== undefined) updateData.username = data.username;
  if (data.node_id !== undefined) updateData.node_id = data.node_id;

  // Only update password if a new one is provided
  if (data.password && data.password.length > 0) {
    updateData.password = encrypt(data.password);
  }

  const host = await prisma.database_hosts.update({
    where: { id: hostId },
    data: updateData,
  });

  // Verify connectivity with the (potentially updated) credentials
  let connection: mysql.Connection | null = null;
  try {
    connection = await mysql.createConnection({
      host: host.host,
      port: host.port,
      user: host.username,
      password: data.password && data.password.length > 0
        ? data.password
        : decrypt(host.password),
    });

    await connection.execute('SELECT 1 FROM dual');
  } catch (error) {
    throw new DisplayException(
      'Unable to connect to the database host with the provided credentials. Please verify the details and try again.',
      422
    );
  } finally {
    if (connection) {
      await connection.end().catch(() => {});
    }
  }

  return host;
}
