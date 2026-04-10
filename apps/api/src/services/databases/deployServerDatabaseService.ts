import { prisma } from '../../prisma/client.js';
import { config } from '../../config/index.js';
import { DisplayException } from '../../errors/index.js';
import { createDatabase, generateUniqueDatabaseName } from './databaseManagementService.js';

/**
 * Deploy a new database for a server, automatically selecting a database host.
 * Mirrors app/Services/Databases/DeployServerDatabaseService.php
 */
export async function deployServerDatabase(
  server: { id: number; node_id: number; database_limit?: number | null },
  data: { database: string; remote: string }
): Promise<any> {
  if (!data.database) {
    throw new DisplayException('A database name is required.', 422);
  }
  if (!data.remote) {
    throw new DisplayException('A remote connection string is required.', 422);
  }

  const hosts = await prisma.database_hosts.findMany();

  if (hosts.length === 0) {
    throw new DisplayException(
      'No database hosts are configured on the system. A database cannot be created.',
      500
    );
  }

  // Prefer hosts attached to the same node
  const nodeHosts = hosts.filter(h => h.node_id === server.node_id);

  if (nodeHosts.length === 0 && !config.pterodactyl.clientFeatures.databases.allowRandom) {
    throw new DisplayException(
      'No suitable database host could be found for the server\'s node.',
      500
    );
  }

  const selectedHost = nodeHosts.length > 0
    ? nodeHosts[Math.floor(Math.random() * nodeHosts.length)]
    : hosts[Math.floor(Math.random() * hosts.length)];

  return createDatabase(server, {
    database_host_id: selectedHost.id,
    database: generateUniqueDatabaseName(data.database, server.id),
    remote: data.remote,
  });
}
