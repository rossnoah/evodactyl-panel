import { prisma } from '../../prisma/client.js';
import { DisplayException } from '../../errors/index.js';

/**
 * Delete an egg if it has no servers or children.
 * Mirrors app/Services/Eggs/EggDeletionService.php
 */
export async function deleteEgg(eggId: number): Promise<void> {
  const serverCount = await prisma.servers.count({
    where: { egg_id: eggId },
  });

  if (serverCount > 0) {
    throw new DisplayException(
      'You cannot delete an egg that has servers associated with it.',
      409
    );
  }

  const childrenCount = await prisma.eggs.count({
    where: { config_from: eggId },
  });

  if (childrenCount > 0) {
    throw new DisplayException(
      'You cannot delete an egg that has other eggs referencing it as a parent configuration.',
      409
    );
  }

  await prisma.eggs.delete({
    where: { id: eggId },
  });
}
