import { prisma } from '../../prisma/client.js';

/**
 * Updates an existing location.
 * Mirrors app/Services/Locations/LocationUpdateService.php
 */
export async function updateLocation(
  locationId: number,
  data: { short?: string; long?: string | null },
): Promise<any> {
  const location = await prisma.locations.update({
    where: { id: locationId },
    data,
  });

  return location;
}
