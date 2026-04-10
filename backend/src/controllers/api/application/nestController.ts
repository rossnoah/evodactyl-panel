import { Request, Response } from 'express';
import { prisma } from '../../../prisma/client.js';
import { fractal } from '../../../serializers/fractal.js';
import { NestTransformer } from '../../../transformers/application/nestTransformer.js';
import { createNest } from '../../../services/nests/nestCreationService.js';
import { updateNest } from '../../../services/nests/nestUpdateService.js';
import { deleteNest } from '../../../services/nests/nestDeletionService.js';
import { createNestSchema, updateNestSchema } from '../../../validation/schemas/nest.js';

/**
 * Application API Nest Controller.
 * Mirrors app/Http/Controllers/Api/Application/Nests/NestController.php
 */
export const nestController = {
  /**
   * Return all nests on the panel.
   * GET /api/application/nests
   */
  async index(req: Request, res: Response): Promise<void> {
    const perPage = Math.min(Math.max(parseInt(req.query.per_page as string) || 50, 1), 500);
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);

    const [nests, total] = await Promise.all([
      prisma.nests.findMany({
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { id: 'asc' },
      }),
      prisma.nests.count(),
    ]);

    const transformer = NestTransformer.fromRequest(req);
    const response = await fractal(req)
      .collection(nests)
      .transformWith(transformer)
      .setPagination(total, perPage, page)
      .toArray();

    res.json(response);
  },

  /**
   * Return a single nest.
   * GET /api/application/nests/:id
   */
  async view(req: Request, res: Response): Promise<void> {
    const nestId = parseInt(req.params.id);
    const nest = await prisma.nests.findUniqueOrThrow({
      where: { id: nestId },
    });

    const transformer = NestTransformer.fromRequest(req);
    const response = await fractal(req)
      .item(nest)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  },

  /**
   * Create a new nest.
   * POST /api/application/nests
   */
  async store(req: Request, res: Response): Promise<void> {
    const validated = createNestSchema.parse(req.body);
    const created = await createNest(validated);

    const nest = await prisma.nests.findUnique({ where: { id: created.id } });

    const transformer = NestTransformer.fromRequest(req);
    const response = await fractal(req)
      .item(nest)
      .transformWith(transformer)
      .addMeta({
        resource: `${req.protocol}://${req.get('host')}/api/application/nests/${nest!.id}`,
      })
      .toArray();

    res.status(201).json(response);
  },

  /**
   * Update a nest.
   * PATCH /api/application/nests/:id
   */
  async update(req: Request, res: Response): Promise<void> {
    const nestId = parseInt(req.params.id);
    await prisma.nests.findUniqueOrThrow({ where: { id: nestId } });

    const validated = updateNestSchema.parse(req.body);
    await updateNest(nestId, validated);

    const nest = await prisma.nests.findUnique({ where: { id: nestId } });

    const transformer = NestTransformer.fromRequest(req);
    const response = await fractal(req)
      .item(nest)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  },

  /**
   * Delete a nest.
   * DELETE /api/application/nests/:id
   */
  async destroy(req: Request, res: Response): Promise<void> {
    const nestId = parseInt(req.params.id);
    await deleteNest(nestId);
    res.status(204).send();
  },
};
