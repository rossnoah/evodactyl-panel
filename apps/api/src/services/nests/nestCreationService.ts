import { prisma } from '../../prisma/client.js';
import { generateUuid } from '../../lib/uuid.js';
import { config } from '../../config/index.js';

/**
 * Create a new nest.
 * Mirrors app/Services/Nests/NestCreationService.php
 */
export async function createNest(data: {
  name: string;
  description?: string | null;
}, author?: string) {
  return prisma.nests.create({
    data: {
      uuid: generateUuid(),
      author: author ?? config.pterodactyl.service.author,
      name: data.name,
      description: data.description ?? null,
    },
  });
}
