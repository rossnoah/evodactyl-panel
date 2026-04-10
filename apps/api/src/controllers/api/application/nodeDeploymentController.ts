import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../prisma/client.js';
import { fractal } from '../../../serializers/fractal.js';
import { NodeTransformer } from '../../../transformers/application/nodeTransformer.js';

/**
 * Finds deployable nodes matching the given resource requirements.
 * Mirrors app/Http/Controllers/Api/Application/Nodes/NodeDeploymentController.php
 *
 * GET /api/application/nodes/deployable
 * Query params: memory, disk, location_ids[], per_page, page
 */
export const getDeployableNodes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.per_page as string) || 50;
    const memory = parseInt(req.query.memory as string) || 0;
    const disk = parseInt(req.query.disk as string) || 0;

    // Parse location_ids from query
    let locationIds: number[] = [];
    const rawLocationIds = req.query.location_ids;
    if (Array.isArray(rawLocationIds)) {
      locationIds = rawLocationIds.map((id) => parseInt(id as string, 10)).filter((id) => !isNaN(id));
    } else if (typeof rawLocationIds === 'string') {
      locationIds = rawLocationIds.split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id));
    }

    // Build query: find nodes that have enough available memory and disk
    // considering overallocation settings
    const where: Record<string, any> = {};
    if (locationIds.length > 0) {
      where.location_id = { in: locationIds };
    }

    // Get all candidate nodes
    const allNodes = await prisma.nodes.findMany({ where });

    // Filter nodes by available resources
    const viableNodes: any[] = [];
    for (const node of allNodes) {
      const serverAgg = await prisma.servers.aggregate({
        where: { node_id: node.id },
        _sum: { memory: true, disk: true },
      });

      const usedMemory = serverAgg._sum.memory ?? 0;
      const usedDisk = serverAgg._sum.disk ?? 0;

      // Calculate total available resources with overallocation
      const totalMemory = node.memory_overallocate > 0
        ? node.memory + (node.memory * node.memory_overallocate / 100)
        : (node.memory_overallocate === -1 ? Infinity : node.memory);

      const totalDisk = node.disk_overallocate > 0
        ? node.disk + (node.disk * node.disk_overallocate / 100)
        : (node.disk_overallocate === -1 ? Infinity : node.disk);

      const availableMemory = totalMemory - usedMemory;
      const availableDisk = totalDisk - usedDisk;

      if (availableMemory >= memory && availableDisk >= disk) {
        viableNodes.push(node);
      }
    }

    const total = viableNodes.length;
    const paged = viableNodes.slice((page - 1) * perPage, page * perPage);

    const transformer = NodeTransformer.fromRequest(req);
    const response = await fractal(req)
      .collection(paged)
      .transformWith(transformer)
      .setPagination(total, perPage, page)
      .toArray();

    res.json(response);
  } catch (err) {
    next(err);
  }
};
