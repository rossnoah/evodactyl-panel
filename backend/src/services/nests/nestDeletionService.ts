import { prisma } from '../../prisma/client.js';
import { DisplayException } from '../../errors/index.js';

/**
 * Delete a nest if no servers are attached.
 * Mirrors app/Services/Nests/NestDeletionService.php
 */
export async function deleteNest(nestId: number): Promise<void> {
  const serverCount = await prisma.servers.count({
    where: { nest_id: nestId },
  });

  if (serverCount > 0) {
    throw new DisplayException(
      'You cannot delete a nest that has servers associated with it.',
      409
    );
  }

  await prisma.nests.delete({
    where: { id: nestId },
  });
}
