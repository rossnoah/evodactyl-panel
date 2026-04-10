import type { NextFunction, Request, Response } from '@/types/express.js';
import { prisma } from '../../../prisma/client.js';
import { fractal } from '../../../serializers/fractal.js';
import { createMount } from '../../../services/mounts/mountCreationService.js';
import { deleteMount } from '../../../services/mounts/mountDeletionService.js';
import { updateMount } from '../../../services/mounts/mountUpdateService.js';
import { MountTransformer } from '../../../transformers/application/mountTransformer.js';
import { createMountSchema, updateMountSchema } from '../../../validation/schemas/mount.js';

/**
 * List all mounts.
 * GET /api/application/mounts
 */
export const index = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string, 10) || 1;
        const perPage = parseInt(req.query.per_page as string, 10) || 50;

        const [mounts, total] = await Promise.all([
            prisma.mounts.findMany({
                skip: (page - 1) * perPage,
                take: perPage,
                orderBy: { id: 'asc' },
            }),
            prisma.mounts.count(),
        ]);

        const transformer = MountTransformer.fromRequest(req);
        const response = await fractal(req)
            .collection(mounts)
            .transformWith(transformer)
            .setPagination(total, perPage, page)
            .toArray();

        res.json(response);
    } catch (err) {
        next(err);
    }
};

/**
 * View a single mount.
 * GET /api/application/mounts/:id
 */
export const view = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const mountId = parseInt(req.params.id, 10);
        const mount = await prisma.mounts.findUnique({ where: { id: mountId } });

        if (!mount) {
            res.status(404).json({ error: 'Mount not found.' });
            return;
        }

        const transformer = MountTransformer.fromRequest(req);
        const response = await fractal(req).item(mount).transformWith(transformer).toArray();

        res.json(response);
    } catch (err) {
        next(err);
    }
};

/**
 * Create a new mount.
 * POST /api/application/mounts
 */
export const store = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const validated = createMountSchema.parse(req.body);
        const created = await createMount(validated);

        const mount = await prisma.mounts.findUnique({ where: { id: created.id } });

        const transformer = MountTransformer.fromRequest(req);
        const response = await fractal(req)
            .item(mount)
            .transformWith(transformer)
            .addMeta({
                resource: `${req.protocol}://${req.get('host')}/api/application/mounts/${mount!.id}`,
            })
            .toArray();

        res.status(201).json(response);
    } catch (err) {
        next(err);
    }
};

/**
 * Update a mount.
 * PATCH /api/application/mounts/:id
 */
export const update = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const mountId = parseInt(req.params.id, 10);
        const existing = await prisma.mounts.findUnique({ where: { id: mountId } });
        if (!existing) {
            res.status(404).json({ error: 'Mount not found.' });
            return;
        }

        const validated = updateMountSchema.parse(req.body);
        await updateMount(mountId, validated);

        const mount = await prisma.mounts.findUnique({ where: { id: mountId } });

        const transformer = MountTransformer.fromRequest(req);
        const response = await fractal(req).item(mount).transformWith(transformer).toArray();

        res.json(response);
    } catch (err) {
        next(err);
    }
};

/**
 * Delete a mount.
 * DELETE /api/application/mounts/:id
 */
export const remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const mountId = parseInt(req.params.id, 10);
        await deleteMount(mountId);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

/**
 * Add egg associations to a mount.
 * POST /api/application/mounts/:id/eggs
 */
export const addEggs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const mountId = parseInt(req.params.id, 10);
        const eggs: number[] = req.body.eggs || [];

        await prisma.egg_mount.createMany({
            data: eggs.map((egg_id) => ({ egg_id, mount_id: mountId })),
            skipDuplicates: true,
        });

        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

/**
 * Add node associations to a mount.
 * POST /api/application/mounts/:id/nodes
 */
export const addNodes = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const mountId = parseInt(req.params.id, 10);
        const nodes: number[] = req.body.nodes || [];

        await prisma.mount_node.createMany({
            data: nodes.map((node_id) => ({ node_id, mount_id: mountId })),
            skipDuplicates: true,
        });

        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

/**
 * Remove an egg association from a mount.
 * DELETE /api/application/mounts/:id/eggs/:eggId
 */
export const removeEgg = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const mountId = parseInt(req.params.id, 10);
        const eggId = parseInt(req.params.eggId, 10);

        await prisma.egg_mount.delete({
            where: {
                egg_id_mount_id: { egg_id: eggId, mount_id: mountId },
            },
        });

        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

/**
 * Remove a node association from a mount.
 * DELETE /api/application/mounts/:id/nodes/:nodeId
 */
export const removeNode = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const mountId = parseInt(req.params.id, 10);
        const nodeId = parseInt(req.params.nodeId, 10);

        await prisma.mount_node.delete({
            where: {
                node_id_mount_id: { node_id: nodeId, mount_id: mountId },
            },
        });

        res.status(204).send();
    } catch (err) {
        next(err);
    }
};
