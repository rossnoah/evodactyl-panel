import type { Request, Response } from '@/types/express.js';
import { DisplayException } from '../../../errors/index.js';
import { prisma } from '../../../prisma/client.js';
import { fractal } from '../../../serializers/fractal.js';
import { createEgg } from '../../../services/eggs/eggCreationService.js';
import { deleteEgg } from '../../../services/eggs/eggDeletionService.js';
import { updateEgg } from '../../../services/eggs/eggUpdateService.js';
import { EggTransformer } from '../../../transformers/application/eggTransformer.js';
import { createEggSchema, updateEggSchema } from '../../../validation/schemas/egg.js';

/**
 * Application API Egg Controller.
 * Mirrors app/Http/Controllers/Api/Application/Nests/EggController.php
 */
export const eggController = {
    /**
     * Return all eggs for a given nest.
     * GET /api/application/nests/:nestId/eggs
     */
    async index(req: Request, res: Response): Promise<void> {
        const nestId = parseInt(req.params.nestId, 10);

        // Ensure nest exists
        await prisma.nests.findUniqueOrThrow({ where: { id: nestId } });

        const eggs = await prisma.eggs.findMany({
            where: { nest_id: nestId },
            orderBy: { id: 'asc' },
        });

        const transformer = EggTransformer.fromRequest(req);
        const response = await fractal(req).collection(eggs).transformWith(transformer).toArray();

        res.json(response);
    },

    /**
     * Return a single egg from a nest.
     * GET /api/application/nests/:nestId/eggs/:eggId
     */
    async view(req: Request, res: Response): Promise<void> {
        const nestId = parseInt(req.params.nestId, 10);
        const eggId = parseInt(req.params.eggId, 10);

        // Ensure nest exists
        await prisma.nests.findUniqueOrThrow({ where: { id: nestId } });

        const egg = await prisma.eggs.findFirstOrThrow({
            where: { id: eggId, nest_id: nestId },
        });

        const transformer = EggTransformer.fromRequest(req);
        const response = await fractal(req).item(egg).transformWith(transformer).toArray();

        res.json(response);
    },

    /**
     * Create a new egg under a nest.
     * POST /api/application/nests/:nestId/eggs
     */
    async store(req: Request, res: Response): Promise<void> {
        const nestId = parseInt(req.params.nestId, 10);
        await prisma.nests.findUniqueOrThrow({ where: { id: nestId } });

        const validated = createEggSchema.parse({ ...req.body, nest_id: nestId });
        const created = await createEgg(validated);

        const egg = await prisma.eggs.findUnique({ where: { id: created.id } });

        const transformer = EggTransformer.fromRequest(req);
        const response = await fractal(req)
            .item(egg)
            .transformWith(transformer)
            .addMeta({
                resource: `${req.protocol}://${req.get('host')}/api/application/nests/${nestId}/eggs/${egg!.id}`,
            })
            .toArray();

        res.status(201).json(response);
    },

    /**
     * Update an egg.
     * PATCH /api/application/nests/:nestId/eggs/:eggId
     */
    async update(req: Request, res: Response): Promise<void> {
        const nestId = parseInt(req.params.nestId, 10);
        const eggId = parseInt(req.params.eggId, 10);

        await prisma.nests.findUniqueOrThrow({ where: { id: nestId } });
        await prisma.eggs.findFirstOrThrow({ where: { id: eggId, nest_id: nestId } });

        const validated = updateEggSchema.parse(req.body);
        await updateEgg(eggId, nestId, validated);

        const egg = await prisma.eggs.findUnique({ where: { id: eggId } });

        const transformer = EggTransformer.fromRequest(req);
        const response = await fractal(req).item(egg).transformWith(transformer).toArray();

        res.json(response);
    },

    /**
     * Delete an egg.
     * DELETE /api/application/nests/:nestId/eggs/:eggId
     */
    async destroy(req: Request, res: Response): Promise<void> {
        const eggId = parseInt(req.params.eggId, 10);
        await deleteEgg(eggId);
        res.status(204).send();
    },

    /**
     * Update an egg's install script.
     * PATCH /api/application/nests/:nestId/eggs/:eggId/script
     */
    async updateScript(req: Request, res: Response): Promise<void> {
        const nestId = parseInt(req.params.nestId, 10);
        const eggId = parseInt(req.params.eggId, 10);

        await prisma.nests.findUniqueOrThrow({ where: { id: nestId } });
        await prisma.eggs.findFirstOrThrow({ where: { id: eggId, nest_id: nestId } });

        const { updateInstallScript } = await import('../../../services/eggs/scripts/installScriptService.js');
        const { updateEggScriptSchema } = await import('../../../validation/schemas/eggScript.js');

        const validated = updateEggScriptSchema.parse(req.body);
        await updateInstallScript(eggId, validated);

        const egg = await prisma.eggs.findUnique({ where: { id: eggId } });

        const transformer = EggTransformer.fromRequest(req);
        const response = await fractal(req).item(egg).transformWith(transformer).toArray();

        res.json(response);
    },

    /**
     * Import an egg from a JSON file into a nest.
     * POST /api/application/nests/:nestId/eggs/import
     */
    async importEgg(req: Request, res: Response): Promise<void> {
        const nestId = parseInt(req.params.nestId, 10);
        await prisma.nests.findUniqueOrThrow({ where: { id: nestId } });

        const jsonContent = req.body.json_content;
        if (!jsonContent || typeof jsonContent !== 'string') {
            throw new DisplayException('Missing or invalid json_content field.', 422);
        }

        const { importEgg } = await import('../../../services/eggs/sharing/eggImporterService.js');
        const egg = await importEgg(jsonContent, nestId);

        const transformer = EggTransformer.fromRequest(req);
        const response = await fractal(req)
            .item(egg)
            .transformWith(transformer)
            .addMeta({
                resource: `${req.protocol}://${req.get('host')}/api/application/nests/${nestId}/eggs/${egg.id}`,
            })
            .toArray();

        res.status(201).json(response);
    },

    /**
     * Update an existing egg from an imported JSON file.
     * PUT /api/application/nests/:nestId/eggs/:eggId/import
     */
    async updateImport(req: Request, res: Response): Promise<void> {
        const nestId = parseInt(req.params.nestId, 10);
        const eggId = parseInt(req.params.eggId, 10);

        await prisma.nests.findUniqueOrThrow({ where: { id: nestId } });
        await prisma.eggs.findFirstOrThrow({ where: { id: eggId, nest_id: nestId } });

        const jsonContent = req.body.json_content;
        if (!jsonContent || typeof jsonContent !== 'string') {
            throw new DisplayException('Missing or invalid json_content field.', 422);
        }

        const { updateEggFromImport } = await import('../../../services/eggs/sharing/eggUpdateImporterService.js');
        await updateEggFromImport(eggId, jsonContent);

        const egg = await prisma.eggs.findUnique({ where: { id: eggId } });

        const transformer = EggTransformer.fromRequest(req);
        const response = await fractal(req).item(egg).transformWith(transformer).toArray();

        res.json(response);
    },

    /**
     * Export an egg as a JSON file download.
     * GET /api/application/nests/:nestId/eggs/:eggId/export
     */
    async exportEgg(req: Request, res: Response): Promise<void> {
        const nestId = parseInt(req.params.nestId, 10);
        const eggId = parseInt(req.params.eggId, 10);

        await prisma.nests.findUniqueOrThrow({ where: { id: nestId } });
        const egg = await prisma.eggs.findFirstOrThrow({ where: { id: eggId, nest_id: nestId } });

        const { exportEgg } = await import('../../../services/eggs/sharing/eggExporterService.js');
        const json = await exportEgg(eggId);

        const kebabName = egg.name
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
        res.setHeader('Content-Disposition', `attachment; filename=egg-${kebabName}.json`);
        res.setHeader('Content-Type', 'application/json');
        res.send(json);
    },
};
