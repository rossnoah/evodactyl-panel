import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../prisma/client.js';
import { fractal } from '../../../serializers/fractal.js';
import { NodeTransformer } from '../../../transformers/application/nodeTransformer.js';
import { createNode } from '../../../services/nodes/nodeCreationService.js';
import { updateNode } from '../../../services/nodes/nodeUpdateService.js';
import { deleteNode } from '../../../services/nodes/nodeDeletionService.js';
import { validateStoreNode, normalizeNodeData } from '../../../validation/schemas/node.js';

/**
 * Builds a Prisma `where` clause from ?filter[field]=value query params.
 */
function buildNodeFilters(query: Record<string, any>): Record<string, any> {
  const where: Record<string, any> = {};
  const filter = query.filter;
  if (filter && typeof filter === 'object') {
    if (filter.uuid) where.uuid = { contains: filter.uuid };
    if (filter.name) where.name = { contains: filter.name };
    if (filter.fqdn) where.fqdn = { contains: filter.fqdn };
    if (filter.daemon_token_id) where.daemon_token_id = { contains: filter.daemon_token_id };
  }
  return where;
}

function buildNodeSort(query: Record<string, any>): Record<string, 'asc' | 'desc'> | undefined {
  const sort = query.sort;
  if (typeof sort !== 'string') return undefined;

  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  const allowed = ['id', 'uuid', 'memory', 'disk'];
  if (!allowed.includes(field)) return undefined;

  return { [field]: desc ? 'desc' : 'asc' };
}

/**
 * List all nodes.
 * GET /api/application/nodes
 */
export const index = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.per_page as string) || 50;
    const where = buildNodeFilters(req.query as any);
    const orderBy = buildNodeSort(req.query as any);

    const [nodes, total] = await Promise.all([
      prisma.nodes.findMany({
        where,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.nodes.count({ where }),
    ]);

    const transformer = NodeTransformer.fromRequest(req);
    const response = await fractal(req)
      .collection(nodes)
      .transformWith(transformer)
      .setPagination(total, perPage, page)
      .toArray();

    res.json(response);
  } catch (err) {
    next(err);
  }
};

/**
 * View a single node.
 * GET /api/application/nodes/:id
 */
export const view = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nodeId = parseInt(req.params.id, 10);
    const node = await prisma.nodes.findUnique({ where: { id: nodeId } });

    if (!node) {
      return res.status(404).json({ error: 'Node not found.' });
    }

    const transformer = NodeTransformer.fromRequest(req);
    const response = await fractal(req)
      .item(node)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new node.
 * POST /api/application/nodes
 */
export const store = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = validateStoreNode(req.body);
    const normalized = normalizeNodeData(validated);
    const node = await createNode(normalized);

    const transformer = NodeTransformer.fromRequest(req);
    const response = await fractal(req)
      .item(node)
      .transformWith(transformer)
      .addMeta({
        resource: `/api/application/nodes/${node.id}`,
      })
      .toArray();

    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
};

/**
 * Update an existing node.
 * PATCH /api/application/nodes/:id
 */
export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nodeId = parseInt(req.params.id, 10);
    const existing = await prisma.nodes.findUnique({ where: { id: nodeId } });
    if (!existing) {
      return res.status(404).json({ error: 'Node not found.' });
    }

    const resetSecret = req.body.reset_secret === true;
    const normalized = normalizeNodeData(req.body);
    const node = await updateNode(nodeId, normalized, resetSecret);

    const transformer = NodeTransformer.fromRequest(req);
    const response = await fractal(req)
      .item(node)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a node.
 * DELETE /api/application/nodes/:id
 */
export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nodeId = parseInt(req.params.id, 10);
    await deleteNode(nodeId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
