import { prisma } from '../../prisma/client.js';
import { DisplayException } from '../../errors/index.js';

/**
 * Deletes a location if no nodes are attached.
 * Mirrors app/Services/Locations/LocationDeletionService.php
 */
export async function deleteLocation(locationId: number): Promise<void> {
  const nodeCount = await prisma.nodes.count({
    where: { location_id: locationId },
  });

  if (nodeCount > 0) {
    throw new DisplayException(
      'You cannot delete a location that has nodes assigned to it.',
      409,
    );
  }

  await prisma.locations.delete({
    where: { id: locationId },
  });
}
