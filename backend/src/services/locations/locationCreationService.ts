import { prisma } from '../../prisma/client.js';

/**
 * Creates a new location.
 * Mirrors app/Services/Locations/LocationCreationService.php
 */
export async function createLocation(data: { short: string; long?: string | null }): Promise<any> {
  const now = new Date();
  const location = await prisma.locations.create({
    data: {
      short: data.short,
      long: data.long ?? null,
      created_at: now,
      updated_at: now,
    },
  });

  return location;
}
