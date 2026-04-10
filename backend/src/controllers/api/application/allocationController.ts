import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../prisma/client.js';
import { fractal } from '../../../serializers/fractal.js';
import { AllocationTransformer } from '../../../transformers/application/allocationTransformer.js';
import { assignAllocations } from '../../../services/allocations/assignmentService.js';
import { deleteAllocation } from '../../../services/allocations/allocationDeletionService.js';
import { validateStoreAllocation } from '../../../validation/schemas/allocation.js';

/**
 * Builds a Prisma `where` clause from ?filter[field]=value query params for allocations.
 */
function buildAllocationFilters(query: Record<string, any>, nodeId: number): Record<string, any> {
  const where: Record<string, any> = { node_id: nodeId };
  const filter = query.filter;
  if (filter && typeof filter === 'object') {
    if (filter.ip) where.ip = { contains: filter.ip };
    if (filter.port) where.port = parseInt(filter.port, 10);
    if (filter.ip_alias) where.ip_alias = { contains: filter.ip_alias };
    if (filter.server_id !== undefined) {
      const serverId = filter.server_id;
      if (!serverId || serverId === 'false' || serverId === '0' || serverId === '') {
        where.server_id = null;
      } else if (/^\d+$/.test(String(serverId))) {
        where.server_id = parseInt(String(serverId), 10);
      } else {
        where.server_id = null;
      }
    }
  }
  return where;
}

/**
 * List all allocations for a node.
 * GET /api/application/nodes/:nodeId/allocations
 */
export const index = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nodeId = parseInt(req.params.nodeId, 10);
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.per_page as string) || 50;
    const where = buildAllocationFilters(req.query as any, nodeId);

    const [allocations, total] = await Promise.all([
      prisma.allocations.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { id: 'asc' },
      }),
      prisma.allocations.count({ where }),
    ]);

    const transformer = AllocationTransformer.fromRequest(req);
    const response = await fractal(req)
      .collection(allocations)
      .transformWith(transformer)
      .setPagination(total, perPage, page)
      .toArray();

    res.json(response);
  } catch (err) {
    next(err);
  }
};

/**
 * Store new allocations for a node.
 * POST /api/application/nodes/:nodeId/allocations
 */
export const store = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nodeId = parseInt(req.params.nodeId, 10);

    // Verify the node exists
    const node = await prisma.nodes.findUnique({ where: { id: nodeId } });
    if (!node) {
      return res.status(404).json({ error: 'Node not found.' });
    }

    const validated = validateStoreAllocation(req.body);
    await assignAllocations(nodeId, validated);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

/**
 * Delete an allocation.
 * DELETE /api/application/nodes/:nodeId/allocations/:id
 */
export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allocationId = parseInt(req.params.id, 10);
    await deleteAllocation(allocationId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

/**
 * Update the alias on an allocation.
 * PATCH /api/application/nodes/:nodeId/allocations/:id
 */
export const updateAlias = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nodeId = parseInt(req.params.nodeId, 10);
    const allocationId = parseInt(req.params.id, 10);
    const alias = req.body.alias ?? null;

    if (alias !== null && typeof alias !== 'string') {
      return res.status(422).json({ error: 'Alias must be a string or null.' });
    }
    if (alias !== null && alias.length > 191) {
      return res.status(422).json({ error: 'Alias must be 191 characters or fewer.' });
    }

    const allocation = await prisma.allocations.findFirst({
      where: { id: allocationId, node_id: nodeId },
    });

    if (!allocation) {
      return res.status(404).json({ error: 'Allocation not found.' });
    }

    await prisma.allocations.update({
      where: { id: allocationId },
      data: { ip_alias: alias || null },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

/**
 * Bulk delete allocations.
 * DELETE /api/application/nodes/:nodeId/allocations (with body { ids: number[] })
 */
export const bulkRemove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nodeId = parseInt(req.params.nodeId, 10);
    const ids: number[] = req.body.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(422).json({ error: 'An array of allocation IDs is required.' });
    }

    // Verify all allocations belong to this node and are unassigned
    const allocations = await prisma.allocations.findMany({
      where: { id: { in: ids }, node_id: nodeId },
    });

    if (allocations.length !== ids.length) {
      return res.status(404).json({ error: 'One or more allocations were not found on this node.' });
    }

    const assigned = allocations.filter(a => a.server_id !== null);
    if (assigned.length > 0) {
      return res.status(409).json({ error: 'Cannot delete allocations that are assigned to a server.' });
    }

    await prisma.allocations.deleteMany({
      where: { id: { in: ids }, node_id: nodeId, server_id: null },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
