import type { NextFunction, Request, Response } from '@/types/express.js';
import { prisma } from '../../../prisma/client.js';
import { fractal } from '../../../serializers/fractal.js';
import { BuildModificationService } from '../../../services/servers/buildModificationService.js';
import { DetailsModificationService } from '../../../services/servers/detailsModificationService.js';
import { ServerTransformer } from '../../../transformers/application/serverTransformer.js';

const buildService = new BuildModificationService();
const detailsService = new DetailsModificationService();

/**
 * Update server details (name, description, owner, external_id).
 * PATCH /api/application/servers/:id/details
 */
export const details = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const server = await prisma.servers.findUniqueOrThrow({
            where: { id: Number(req.params.id) },
            include: { allocations: true, eggs: true, nodes: true },
        });

        const updated = await detailsService.handle(server, req.body);

        const fullServer = await prisma.servers.findUniqueOrThrow({
            where: { id: updated.id },
            include: { allocations: true, eggs: true, nodes: true },
        });

        const transformer = new ServerTransformer();
        transformer.setRequest(req);

        const response = await fractal(req).item(fullServer).transformWith(transformer).toArray();

        res.json(response);
    } catch (error) {
        next(error);
    }
};

/**
 * Update server build configuration (resources, allocations).
 * PATCH /api/application/servers/:id/build
 */
export const build = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const server = await prisma.servers.findUniqueOrThrow({
            where: { id: Number(req.params.id) },
            include: { allocations: true, eggs: true, nodes: true },
        });

        const updated = await buildService.handle(server, req.body);

        const transformer = new ServerTransformer();
        transformer.setRequest(req);

        const response = await fractal(req).item(updated).transformWith(transformer).toArray();

        res.json(response);
    } catch (error) {
        next(error);
    }
};
