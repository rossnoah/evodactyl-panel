import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../../prisma/client.js';
import { fractal } from '../../../../serializers/fractal.js';
import { ClientAllocationTransformer } from '../../../../transformers/client/allocationTransformer.js';
import { findAssignableAllocation } from '../../../../services/allocations/findAssignableAllocationService.js';
import { activityFromRequest } from '../../../../services/activity/activityLogService.js';
import { DisplayException } from '../../../../errors/index.js';

/**
 * Lists all allocations for a server.
 * GET /api/client/servers/:server/network/allocations
 */
export const index = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = (req as any).server;

    const allocations = await prisma.allocations.findMany({
      where: { server_id: server.id },
      include: { server: true },
    });

    // Attach server reference for is_default computation
    const withServer = allocations.map((a: any) => ({
      ...a,
      server,
    }));

    const transformer = ClientAllocationTransformer.fromRequest(req);
    const response = await fractal(req)
      .collection(withServer)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  } catch (err) {
    next(err);
  }
};

/**
 * Update notes on an allocation.
 * POST /api/client/servers/:server/network/allocations/:allocation
 */
export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = (req as any).server;
    const allocationId = parseInt(req.params.allocation, 10);

    const allocation = await prisma.allocations.findFirst({
      where: { id: allocationId, server_id: server.id },
    });

    if (!allocation) {
      return res.status(404).json({ error: 'Allocation not found.' });
    }

    const originalNotes = allocation.notes;
    const newNotes = req.body.notes ?? null;

    const updated = await prisma.allocations.update({
      where: { id: allocationId },
      data: { notes: newNotes },
    });

    if (originalNotes !== newNotes) {
      await activityFromRequest(req)
        .event('server:allocation.notes')
        .subject(allocation, 'Allocation')
        .property({
          allocation: `${allocation.ip}:${allocation.port}`,
          old: originalNotes,
          new: newNotes,
        })
        .log();
    }

    const withServer = { ...updated, server };
    const transformer = ClientAllocationTransformer.fromRequest(req);
    const response = await fractal(req)
      .item(withServer)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  } catch (err) {
    next(err);
  }
};

/**
 * Set the primary allocation for a server.
 * POST /api/client/servers/:server/network/allocations/:allocation/primary
 */
export const setPrimary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = (req as any).server;
    const allocationId = parseInt(req.params.allocation, 10);

    const allocation = await prisma.allocations.findFirst({
      where: { id: allocationId, server_id: server.id },
    });

    if (!allocation) {
      return res.status(404).json({ error: 'Allocation not found.' });
    }

    await prisma.servers.update({
      where: { id: server.id },
      data: { allocation_id: allocationId },
    });

    await activityFromRequest(req)
      .event('server:allocation.primary')
      .subject(allocation, 'Allocation')
      .property('allocation', `${allocation.ip}:${allocation.port}`)
      .log();

    // Return allocation with updated server context
    const updatedServer = { ...server, allocation_id: allocationId };
    const withServer = { ...allocation, server: updatedServer };
    const transformer = ClientAllocationTransformer.fromRequest(req);
    const response = await fractal(req)
      .item(withServer)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new allocation for a server (auto-assign).
 * POST /api/client/servers/:server/network/allocations
 */
export const store = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = (req as any).server;

    // Check allocation limit
    if (server.allocation_limit) {
      const currentCount = await prisma.allocations.count({
        where: { server_id: server.id },
      });

      if (currentCount >= server.allocation_limit) {
        throw new DisplayException(
          'Cannot assign additional allocations to this server: limit has been reached.',
        );
      }
    }

    const allocation = await findAssignableAllocation(server);

    await activityFromRequest(req)
      .event('server:allocation.create')
      .subject(allocation, 'Allocation')
      .property('allocation', `${allocation.ip}:${allocation.port}`)
      .log();

    const withServer = { ...allocation, server };
    const transformer = ClientAllocationTransformer.fromRequest(req);
    const response = await fractal(req)
      .item(withServer)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  } catch (err) {
    next(err);
  }
};

/**
 * Delete an allocation from a server.
 * DELETE /api/client/servers/:server/network/allocations/:allocation
 */
export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = (req as any).server;
    const allocationId = parseInt(req.params.allocation, 10);

    // Don't allow deletion if no allocation limit is set
    if (!server.allocation_limit) {
      throw new DisplayException(
        'You cannot delete allocations for this server: no allocation limit is set.',
      );
    }

    // Don't allow deleting the primary allocation
    if (allocationId === server.allocation_id) {
      throw new DisplayException(
        'You cannot delete the primary allocation for this server.',
      );
    }

    const allocation = await prisma.allocations.findFirst({
      where: { id: allocationId, server_id: server.id },
    });

    if (!allocation) {
      return res.status(404).json({ error: 'Allocation not found.' });
    }

    // Unassign the allocation (don't actually delete it from the node)
    await prisma.allocations.update({
      where: { id: allocationId },
      data: { notes: null, server_id: null },
    });

    await activityFromRequest(req)
      .event('server:allocation.delete')
      .subject(allocation, 'Allocation')
      .property('allocation', `${allocation.ip}:${allocation.port}`)
      .log();

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
