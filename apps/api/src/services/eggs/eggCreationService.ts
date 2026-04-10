import { prisma } from '../../prisma/client.js';
import { generateUuid } from '../../lib/uuid.js';
import { config } from '../../config/index.js';
import { DisplayException } from '../../errors/index.js';

/**
 * Create a new egg.
 * Mirrors app/Services/Eggs/EggCreationService.php
 */
export async function createEgg(data: {
  nest_id: number;
  name: string;
  description?: string | null;
  docker_images: Record<string, string>;
  startup: string;
  config_from?: number | null;
  config_stop?: string | null;
  config_startup?: string | null;
  config_logs?: string | null;
  config_files?: string | null;
  features?: string[] | null;
  file_denylist?: string[] | null;
  force_outgoing_ip?: boolean;
}) {
  // Validate config_from if provided
  if (data.config_from != null) {
    const parentCount = await prisma.eggs.count({
      where: {
        nest_id: data.nest_id,
        id: data.config_from,
      },
    });

    if (parentCount !== 1) {
      throw new DisplayException(
        'The parent configuration egg must belong to the same nest.',
        422
      );
    }
  }

  return prisma.eggs.create({
    data: {
      uuid: generateUuid(),
      author: config.pterodactyl.service.author,
      nest_id: data.nest_id,
      name: data.name,
      description: data.description ?? null,
      docker_images: JSON.stringify(data.docker_images),
      startup: data.startup,
      config_from: data.config_from ?? null,
      config_stop: data.config_stop ?? null,
      config_startup: data.config_startup ?? null,
      config_logs: data.config_logs ?? null,
      config_files: data.config_files ?? null,
      features: data.features ? JSON.stringify(data.features) : null,
      file_denylist: data.file_denylist ? JSON.stringify(data.file_denylist) : null,
      force_outgoing_ip: data.force_outgoing_ip ?? false,
    },
  });
}
