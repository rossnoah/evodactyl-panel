import { prisma } from '../../prisma/client.js';
import { DisplayException } from '../../errors/index.js';

/**
 * Delete a mount if no servers are using it.
 * Mirrors app/Services/Mounts/MountDeletionService.php
 */
export async function deleteMount(mountId: number): Promise<void> {
  const serverCount = await prisma.mount_server.count({
    where: { mount_id: mountId },
  });

  if (serverCount > 0) {
    throw new DisplayException(
      'You cannot delete a mount that is currently in use by one or more servers.',
      409
    );
  }

  await prisma.mounts.delete({
    where: { id: mountId },
  });
}
