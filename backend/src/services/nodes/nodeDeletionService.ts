import { prisma } from '../../prisma/client.js';
import { DisplayException } from '../../errors/index.js';

/**
 * Deletes a node from the panel if no servers are attached.
 * Mirrors app/Services/Nodes/NodeDeletionService.php
 */
export async function deleteNode(nodeId: number): Promise<void> {
  const serverCount = await prisma.servers.count({
    where: { node_id: nodeId },
  });

  if (serverCount > 0) {
    throw new DisplayException(
      'You cannot delete a node that has servers assigned to it. Please delete or transfer all servers before removing this node.',
      409,
    );
  }

  await prisma.nodes.delete({
    where: { id: nodeId },
  });
}
