import { prisma } from '../../prisma/client.js';

/**
 * Update a nest, preventing author changes.
 * Mirrors app/Services/Nests/NestUpdateService.php
 */
export async function updateNest(nestId: number, data: {
  name?: string;
  description?: string | null;
}) {
  // Prevent changing the author field
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;

  await prisma.nests.update({
    where: { id: nestId },
    data: updateData,
  });
}
