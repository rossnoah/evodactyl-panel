import { prisma } from '../../prisma/client.js';

/**
 * Update a mount and optionally sync egg/node associations.
 * Mirrors app/Services/Mounts/MountUpdateService.php
 */
export async function updateMount(mountId: number, data: {
  name?: string;
  description?: string | null;
  source?: string;
  target?: string;
  read_only?: boolean;
  user_mountable?: boolean;
  eggs?: number[];
  nodes?: number[];
}) {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.source !== undefined) updateData.source = data.source;
  if (data.target !== undefined) updateData.target = data.target;
  if (data.read_only !== undefined) updateData.read_only = data.read_only ? 1 : 0;
  if (data.user_mountable !== undefined) updateData.user_mountable = data.user_mountable ? 1 : 0;

  await prisma.mounts.update({
    where: { id: mountId },
    data: updateData,
  });

  // Sync egg associations if provided
  if (data.eggs !== undefined) {
    await prisma.egg_mount.deleteMany({ where: { mount_id: mountId } });
    if (data.eggs.length) {
      await prisma.egg_mount.createMany({
        data: data.eggs.map(egg_id => ({ egg_id, mount_id: mountId })),
        skipDuplicates: true,
      });
    }
  }

  // Sync node associations if provided
  if (data.nodes !== undefined) {
    await prisma.mount_node.deleteMany({ where: { mount_id: mountId } });
    if (data.nodes.length) {
      await prisma.mount_node.createMany({
        data: data.nodes.map(node_id => ({ node_id, mount_id: mountId })),
        skipDuplicates: true,
      });
    }
  }
}
