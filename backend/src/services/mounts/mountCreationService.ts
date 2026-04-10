import { prisma } from '../../prisma/client.js';
import { generateUuid } from '../../lib/uuid.js';

/**
 * Create a new mount with optional egg and node associations.
 * Mirrors app/Services/Mounts/MountCreationService.php
 */
export async function createMount(data: {
  name: string;
  description?: string | null;
  source: string;
  target: string;
  read_only?: boolean;
  user_mountable?: boolean;
  eggs?: number[];
  nodes?: number[];
}) {
  const mount = await prisma.mounts.create({
    data: {
      uuid: generateUuid(),
      name: data.name,
      description: data.description ?? null,
      source: data.source,
      target: data.target,
      read_only: data.read_only ? 1 : 0,
      user_mountable: data.user_mountable ? 1 : 0,
    },
  });

  if (data.eggs?.length) {
    await prisma.egg_mount.createMany({
      data: data.eggs.map(egg_id => ({ egg_id, mount_id: mount.id })),
      skipDuplicates: true,
    });
  }

  if (data.nodes?.length) {
    await prisma.mount_node.createMany({
      data: data.nodes.map(node_id => ({ node_id, mount_id: mount.id })),
      skipDuplicates: true,
    });
  }

  return mount;
}
