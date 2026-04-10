import { prisma } from '../../prisma/client.js';
import { DisplayException } from '../../errors/index.js';

/**
 * Deletes an allocation only if it is not assigned to a server.
 * Mirrors app/Services/Allocations/AllocationDeletionService.php
 */
export async function deleteAllocation(allocationId: number): Promise<void> {
  const allocation = await prisma.allocations.findUnique({
    where: { id: allocationId },
  });

  if (!allocation) {
    throw new DisplayException('The requested allocation could not be found.', 404);
  }

  if (allocation.server_id !== null) {
    throw new DisplayException(
      'Cannot delete an allocation that is currently assigned to a server.',
      400,
    );
  }

  await prisma.allocations.delete({
    where: { id: allocationId },
  });
}
