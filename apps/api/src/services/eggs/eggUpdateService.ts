import { prisma } from '../../prisma/client.js';
import { DisplayException } from '../../errors/index.js';

/**
 * Update an existing egg.
 * Mirrors app/Services/Eggs/EggUpdateService.php
 */
export async function updateEgg(eggId: number, nestId: number, data: {
  name?: string;
  description?: string | null;
  docker_images?: Record<string, string>;
  startup?: string;
  config_from?: number | null;
  config_stop?: string | null;
  config_startup?: string | null;
  config_logs?: string | null;
  config_files?: string | null;
  features?: string[] | null;
  force_outgoing_ip?: boolean;
}) {
  // Validate config_from if provided
  if (data.config_from != null) {
    const parentCount = await prisma.eggs.count({
      where: {
        nest_id: nestId,
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

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.docker_images !== undefined) updateData.docker_images = JSON.stringify(data.docker_images);
  if (data.startup !== undefined) updateData.startup = data.startup;
  if (data.config_from !== undefined) updateData.config_from = data.config_from;
  if (data.config_stop !== undefined) updateData.config_stop = data.config_stop;
  if (data.config_startup !== undefined) updateData.config_startup = data.config_startup;
  if (data.config_logs !== undefined) updateData.config_logs = data.config_logs;
  if (data.config_files !== undefined) updateData.config_files = data.config_files;
  if (data.features !== undefined) updateData.features = data.features ? JSON.stringify(data.features) : null;
  if (data.force_outgoing_ip !== undefined) updateData.force_outgoing_ip = data.force_outgoing_ip;

  await prisma.eggs.update({
    where: { id: eggId },
    data: updateData,
  });
}
