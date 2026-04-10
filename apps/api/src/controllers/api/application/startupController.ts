import type { NextFunction, Request, Response } from '@/types/express.js';
import { prisma } from '../../../prisma/client.js';
import { fractal } from '../../../serializers/fractal.js';
import { StartupModificationService } from '../../../services/servers/startupModificationService.js';
import { ServerTransformer } from '../../../transformers/application/serverTransformer.js';

const modificationService = new StartupModificationService();

/**
 * Update the startup and environment settings for a specific server.
 * PATCH /api/application/servers/:id/startup
 */
export const index = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const server = await prisma.servers.findUniqueOrThrow({
            where: { id: Number(req.params.id) },
            include: { allocations: true, eggs: true, nodes: true },
        });

        const updated = await modificationService.setUserLevel('admin').handle(server, req.body);

        const transformer = new ServerTransformer();
        transformer.setRequest(req);

        const response = await fractal(req).item(updated).transformWith(transformer).toArray();

        res.json(response);
    } catch (error) {
        next(error);
    }
};
