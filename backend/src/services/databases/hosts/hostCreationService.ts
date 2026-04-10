import mysql from 'mysql2/promise';
import { prisma } from '../../../prisma/client.js';
import { encrypt } from '../../../lib/encryption.js';
import { DisplayException } from '../../../errors/index.js';

/**
 * Create a new database host on the Panel.
 * Validates connectivity before persisting.
 * Mirrors app/Services/Databases/Hosts/HostCreationService.php
 */
export async function createDatabaseHost(data: {
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  node_id?: number | null;
}) {
  const host = await prisma.database_hosts.create({
    data: {
      name: data.name,
      host: data.host,
      port: data.port,
      username: data.username,
      password: encrypt(data.password),
      max_databases: null,
      node_id: data.node_id ?? null,
    },
  });

  // Verify connectivity
  let connection: mysql.Connection | null = null;
  try {
    connection = await mysql.createConnection({
      host: data.host,
      port: data.port,
      user: data.username,
      password: data.password,
    });

    await connection.execute('SELECT 1 FROM dual');
  } catch (error) {
    // Delete the host record if connectivity fails
    await prisma.database_hosts.delete({ where: { id: host.id } }).catch(() => {});
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
