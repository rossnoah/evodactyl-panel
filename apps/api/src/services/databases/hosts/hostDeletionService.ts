import { prisma } from '../../../prisma/client.js';
import { DisplayException } from '../../../errors/index.js';

/**
 * Delete a database host if no databases are attached to it.
 * Mirrors app/Services/Databases/Hosts/HostDeletionService.php
 */
export async function deleteDatabaseHost(hostId: number): Promise<void> {
  const databaseCount = await prisma.databases.count({
    where: { database_host_id: hostId },
  });

  if (databaseCount > 0) {
    throw new DisplayException(
      'You cannot delete a database host that has databases linked to it.',
      409
    );
  }

  await prisma.database_hosts.delete({
    where: { id: hostId },
  });
}
