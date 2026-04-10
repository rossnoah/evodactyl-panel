import type { NextFunction, Request, Response } from '@/types/express.js';
import { prisma } from '../../../prisma/client.js';
import { fractal } from '../../../serializers/fractal.js';
import { ServerCreationService } from '../../../services/servers/serverCreationService.js';
import { ServerDeletionService } from '../../../services/servers/serverDeletionService.js';
import { ServerTransformer } from '../../../transformers/application/serverTransformer.js';

const creationService = new ServerCreationService();
const deletionService = new ServerDeletionService();

/**
 * List all servers with filtering and pagination.
 * GET /api/application/servers
 */
export const index = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const perPage = Math.min(Number(req.query.per_page) || 50, 500);
        const page = Math.max(Number(req.query.page) || 1, 1);

        // Build filter conditions
        const where: any = {};
        const filters = ['uuid', 'uuidShort', 'name', 'description', 'image', 'external_id'];
        for (const filter of filters) {
            const filterKey = `filter[${filter}]`;
            if (req.query[filterKey]) {
                where[filter] = { contains: String(req.query[filterKey]) };
            }
        }

        const [servers, total] = await Promise.all([
            prisma.servers.findMany({
                where,
                skip: (page - 1) * perPage,
                take: perPage,
                orderBy: { id: 'asc' },
                include: { allocations: true, eggs: true, nodes: true },
            }),
            prisma.servers.count({ where }),
        ]);

        const transformer = new ServerTransformer();
        transformer.setRequest(req);

        const response = await fractal(req)
            .collection(servers)
            .transformWith(transformer)
            .setPagination(total, perPage, page)
            .toArray();

        res.json(response);
    } catch (error) {
        next(error);
    }
};

/**
 * Show a single server.
 * GET /api/application/servers/:id
 */
export const view = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const server = await prisma.servers.findUniqueOrThrow({
            where: { id: Number(req.params.id) },
            include: { allocations: true, eggs: true, nodes: true },
        });

        const transformer = new ServerTransformer();
        transformer.setRequest(req);

        const response = await fractal(req).item(server).transformWith(transformer).toArray();

        res.json(response);
    } catch (error) {
        next(error);
    }
};

/**
 * Show a server by external ID.
 * GET /api/application/servers/external/:externalId
 */
export const viewByExternalId = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const server = await prisma.servers.findFirstOrThrow({
            where: { external_id: req.params.externalId },
            include: { allocations: true, eggs: true, nodes: true },
        });

        const transformer = new ServerTransformer();
        transformer.setRequest(req);

        const response = await fractal(req).item(server).transformWith(transformer).toArray();

        res.json(response);
    } catch (error) {
        next(error);
    }
};

/**
 * Create a new server.
 * POST /api/application/servers
 */
export const store = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = req.body;

        // Build deployment object if deployment data is provided
        let deployment: { locations: number[]; dedicated: boolean; ports: string[] } | undefined;
        if (data.deploy) {
            deployment = {
                locations: (data.deploy.locations || []).map(Number),
                dedicated: Boolean(data.deploy.dedicated_ip),
                ports: (data.deploy.port_range || []).map(String),
            };
        }

        const server = await creationService.handle(data, deployment);

        const transformer = new ServerTransformer();
        transformer.setRequest(req);

        const response = await fractal(req).item(server).transformWith(transformer).toArray();

        res.status(201).json(response);
    } catch (error) {
        next(error);
    }
};

/**
 * Delete a server.
 * DELETE /api/application/servers/:id
 * DELETE /api/application/servers/:id/force
 */
export const deleteServer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const server = await prisma.servers.findUniqueOrThrow({
            where: { id: Number(req.params.id) },
            include: { nodes: true },
        });

        const force = req.path.endsWith('/force');
        await deletionService.withForce(force).handle(server);

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};
