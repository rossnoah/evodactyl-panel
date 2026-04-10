import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../prisma/client.js';
import { decrypt } from '../../../lib/encryption.js';
import { signJwt } from '../../../lib/jwt.js';
import { DaemonTransferRepository } from '../../../repositories/wings/daemonTransferRepository.js';

const daemonTransferRepository = new DaemonTransferRepository();

/**
 * Initiate a server transfer to a different node.
 * POST /api/application/servers/:id/transfer
 *
 * Mirrors app/Http/Controllers/Admin/Servers/ServerTransferController.php
 */
export const transfer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const serverId = Number(req.params.id);
    const { node_id, allocation_id, allocation_additional } = req.body;

    if (!node_id || !allocation_id) {
      return res.status(422).json({ error: 'node_id and allocation_id are required.' });
    }

    const server = await prisma.servers.findUniqueOrThrow({
      where: { id: serverId },
      include: { nodes: true, allocations: true },
    });

    // Verify server is not already transferring
    const existingTransfer = await prisma.server_transfers.findFirst({
      where: { server_id: serverId, successful: null },
    });
    if (existingTransfer) {
      return res.status(409).json({ error: 'A transfer is already in progress for this server.' });
    }

    // Verify destination node exists and is different
    const targetNode = await prisma.nodes.findUniqueOrThrow({
      where: { id: Number(node_id) },
    });

    if (targetNode.id === server.node_id) {
      return res.status(422).json({ error: 'Cannot transfer to the same node.' });
    }

    // Verify the allocation belongs to the target node and is unassigned
    const targetAllocation = await prisma.allocations.findFirst({
      where: { id: Number(allocation_id), node_id: targetNode.id, server_id: null },
    });
    if (!targetAllocation) {
      return res.status(422).json({ error: 'The specified allocation is not available on the target node.' });
    }

    const additionalAllocations: number[] = (allocation_additional || []).map(Number);

    // Check node has enough resources
    const nodeResources = await prisma.servers.aggregate({
      where: { node_id: targetNode.id },
      _sum: { memory: true, disk: true },
    });
    const usedMemory = nodeResources._sum.memory ?? 0;
    const usedDisk = nodeResources._sum.disk ?? 0;

    const memoryLimit = targetNode.memory_overallocate === -1
      ? Infinity
      : targetNode.memory + (targetNode.memory * targetNode.memory_overallocate / 100);
    const diskLimit = targetNode.disk_overallocate === -1
      ? Infinity
      : targetNode.disk + (targetNode.disk * targetNode.disk_overallocate / 100);

    if (usedMemory + server.memory > memoryLimit || usedDisk + server.disk > diskLimit) {
      return res.status(400).json({ error: 'The target node does not have sufficient resources for this transfer.' });
    }

    // Get old additional allocations (all allocations except the primary one)
    const oldAdditionalAllocations = (server.allocations || [])
      .filter((a: any) => a.id !== server.allocation_id)
      .map((a: any) => a.id);

    // Create the transfer record and assign allocations in a transaction
    await prisma.$transaction(async (tx) => {
      // Create server_transfers record
      await tx.server_transfers.create({
        data: {
          server_id: server.id,
          old_node: server.node_id,
          new_node: targetNode.id,
          old_allocation: server.allocation_id,
          new_allocation: Number(allocation_id),
          old_additional_allocations: JSON.stringify(oldAdditionalAllocations),
          new_additional_allocations: JSON.stringify(additionalAllocations),
        },
      });

      // Assign the new allocations to this server so they can't be taken
      const allNewAllocations = [Number(allocation_id), ...additionalAllocations];
      await tx.allocations.updateMany({
        where: {
          id: { in: allNewAllocations },
          node_id: targetNode.id,
          server_id: null,
        },
        data: { server_id: server.id },
      });
    });

    // Generate a JWT for the destination node
    const secret = decrypt(targetNode.daemon_token);
    const token = signJwt(
      { server_id: server.uuid, sub: server.uuid },
      secret,
      { expiresIn: '15m', issuer: 'Pterodactyl Panel' }
    );

    // Notify the source node's daemon of the transfer
    try {
      daemonTransferRepository.setServer(server);
      await daemonTransferRepository.notify(targetNode, token);
    } catch {
      // If daemon notification fails, clean up the transfer record
      await prisma.server_transfers.deleteMany({
        where: { server_id: server.id, successful: null },
      });
      // Release the allocations
      const allNewAllocations = [Number(allocation_id), ...additionalAllocations];
      await prisma.allocations.updateMany({
        where: { id: { in: allNewAllocations }, server_id: server.id },
        data: { server_id: null },
      });
      return res.status(502).json({ error: 'Failed to communicate with the source daemon to initiate transfer.' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
