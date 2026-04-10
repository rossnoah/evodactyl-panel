import { prisma } from '../../prisma/client.js';
import { DisplayException } from '../../errors/index.js';

/**
 * Service for deleting users.
 * Mirrors app/Services/Users/UserDeletionService.php
 *
 * A user can only be deleted if they have no servers attached to their account.
 */
export async function deleteUser(user: any): Promise<void> {
  const userId = typeof user === 'number' ? user : user.id;

  // If we received an ID, fetch the user
  const targetUser = typeof user === 'number'
    ? await prisma.users.findUniqueOrThrow({ where: { id: userId } })
    : user;

  const serverCount = await prisma.servers.count({
    where: { owner_id: targetUser.id },
  });

  if (serverCount > 0) {
    throw new DisplayException('Cannot delete a user that has active servers attached to their account.');
  }

  await prisma.users.delete({
    where: { id: targetUser.id },
  });
}
