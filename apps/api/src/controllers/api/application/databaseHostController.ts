import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../prisma/client.js';
import { fractal } from '../../../serializers/fractal.js';
import { DatabaseHostTransformer } from '../../../transformers/application/databaseHostTransformer.js';
import { createDatabaseHost } from '../../../services/databases/hosts/hostCreationService.js';
import { updateDatabaseHost } from '../../../services/databases/hosts/hostUpdateService.js';
import { deleteDatabaseHost } from '../../../services/databases/hosts/hostDeletionService.js';
import { createDatabaseHostSchema, updateDatabaseHostSchema } from '../../../validation/schemas/databaseHost.js';

/**
 * List all database hosts.
 * GET /api/application/databases
 */
export const index = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.per_page as string) || 50;

    const [hosts, total] = await Promise.all([
      prisma.database_hosts.findMany({
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { id: 'asc' },
      }),
      prisma.database_hosts.count(),
    ]);

    const transformer = DatabaseHostTransformer.fromRequest(req);
    const response = await fractal(req)
      .collection(hosts)
      .transformWith(transformer)
      .setPagination(total, perPage, page)
      .toArray();

    res.json(response);
  } catch (err) {
    next(err);
  }
};

/**
 * View a single database host.
 * GET /api/application/databases/:id
 */
export const view = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hostId = parseInt(req.params.id, 10);
    const host = await prisma.database_hosts.findUnique({ where: { id: hostId } });

    if (!host) {
      return res.status(404).json({ error: 'Database host not found.' });
    }

    const transformer = DatabaseHostTransformer.fromRequest(req);
    const response = await fractal(req)
      .item(host)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new database host.
 * POST /api/application/databases
 */
export const store = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createDatabaseHostSchema.parse(req.body);
    const created = await createDatabaseHost(validated);

    const host = await prisma.database_hosts.findUnique({ where: { id: created.id } });

    const transformer = DatabaseHostTransformer.fromRequest(req);
    const response = await fractal(req)
      .item(host)
      .transformWith(transformer)
      .addMeta({
        resource: `${req.protocol}://${req.get('host')}/api/application/databases/${host!.id}`,
      })
      .toArray();

    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
};

/**
 * Update a database host.
 * PATCH /api/application/databases/:id
 */
export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hostId = parseInt(req.params.id, 10);
    const existing = await prisma.database_hosts.findUnique({ where: { id: hostId } });
    if (!existing) {
      return res.status(404).json({ error: 'Database host not found.' });
    }

    const validated = updateDatabaseHostSchema.parse(req.body);
    const host = await updateDatabaseHost(hostId, validated);

    const transformer = DatabaseHostTransformer.fromRequest(req);
    const response = await fractal(req)
      .item(host)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a database host.
 * DELETE /api/application/databases/:id
 */
export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hostId = parseInt(req.params.id, 10);
    await deleteDatabaseHost(hostId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
