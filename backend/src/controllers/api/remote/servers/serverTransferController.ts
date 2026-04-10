import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../../prisma/client.js';
import { HttpForbiddenException, ConflictHttpException } from '../../../../errors/index.js';
import { DaemonServerRepository } from '../../../../repositories/wings/daemonServerRepository.js';

const daemonServerRepository = new DaemonServerRepository();

/**
 * Handle transfer failure notification from the daemon.
 * POST /api/remote/servers/:uuid/transfer/failure
 */
export const failure = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const node = (req as any).node;
    const uuid = req.params.uuid;

    const server = await prisma.servers.findFirstOrThrow({
      where: { uuid },
    });

    const transfer = await prisma.server_transfers.findFirst({
      where: {
        server_id: server.id,
        successful: null,
      },
    });

    if (!transfer) {
      throw new ConflictHttpException('Server is not being transferred.');
    }

    // Either node can report failure
    if (node.id !== transfer.new_node && node.id !== transfer.old_node) {
      throw new HttpForbiddenException('Requesting node does not have permission to access this server.');
    }

    await processFailedTransfer(transfer);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Handle transfer success notification from the daemon.
 * POST /api/remote/servers/:uuid/transfer/success
 */
export const success = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const node = (req as any).node;
    const uuid = req.params.uuid;

    const server = await prisma.servers.findFirstOrThrow({
      where: { uuid },
    });

    const transfer = await prisma.server_transfers.findFirst({
      where: {
        server_id: server.id,
        successful: null,
      },
    });

    if (!transfer) {
      throw new ConflictHttpException('Server is not being transferred.');
    }

    // Only the new node can report success
    if (node.id !== transfer.new_node) {
      throw new HttpForbiddenException('Requesting node does not have permission to access this server.');
    }

    // Process the successful transfer in a transaction
    await prisma.$transaction(async (tx) => {
      // Release old allocations
      const oldAllocations = [
        transfer.old_allocation,
        ...(transfer.old_additional_allocations
          ? (typeof transfer.old_additional_allocations === 'string'
            ? JSON.parse(transfer.old_additional_allocations)
            : transfer.old_additional_allocations)
          : []),
      ].filter(Boolean);

      if (oldAllocations.length > 0) {
        await tx.allocations.updateMany({
          where: { id: { in: oldAllocations } },
          data: { server_id: null },
        });
      }

      // Update server to new node and allocation
      await tx.servers.update({
        where: { id: server.id },
        data: {
          allocation_id: transfer.new_allocation,
          node_id: transfer.new_node,
        },
      });

      // Mark transfer as successful
      await tx.server_transfers.update({
        where: { id: transfer.id },
        data: { successful: true },
      });
    });

    // Delete the server from the old node (best-effort)
    try {
      const oldNode = await prisma.nodes.findUnique({
        where: { id: transfer.old_node },
      });

      if (oldNode) {
        await daemonServerRepository
          .setServer({ ...server, node: oldNode })
          .setNode(oldNode)
          .deleteServer();
      }
    } catch (error) {
      console.warn('Failed to delete server from old node during transfer:', (error as Error).message);
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Release reserved allocations and mark the transfer as failed.
 */
async function processFailedTransfer(transfer: any): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.server_transfers.update({
      where: { id: transfer.id },
      data: { successful: false },
    });

    // Release new allocations
    const newAllocations = [
      transfer.new_allocation,
      ...(transfer.new_additional_allocations
        ? (typeof transfer.new_additional_allocations === 'string'
          ? JSON.parse(transfer.new_additional_allocations)
          : transfer.new_additional_allocations)
        : []),
    ].filter(Boolean);

    if (newAllocations.length > 0) {
      await tx.allocations.updateMany({
        where: { id: { in: newAllocations } },
        data: { server_id: null },
      });
    }
  });
}
