import type { NextFunction, Request, Response } from '@/types/express.js';
import { permissionGroups } from '../../../permissions.js';
import { prisma } from '../../../prisma/client.js';
import { fractal } from '../../../serializers/fractal.js';
import { ClientServerTransformer } from '../../../transformers/client/serverTransformer.js';

/**
 * Return all servers available to the client making the API request.
 * GET /api/client
 */
export const index = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = (req as any).user;
        const perPage = Math.min(Number(req.query.per_page) || 50, 500);
        const page = Math.max(Number(req.query.page) || 1, 1);
        const type = req.query.type as string | undefined;

        // Build filter conditions
        const where: any = {};
        const filterFields = ['uuid', 'name', 'description', 'external_id'];
        for (const field of filterFields) {
            const key = `filter[${field}]`;
            if (req.query[key]) {
                where[field] = { contains: String(req.query[key]) };
            }
        }

        // Wildcard filter
        if (req.query['filter[*]']) {
            const search = String(req.query['filter[*]']);
            where.OR = [
                { name: { contains: search } },
                { uuid: { contains: search } },
                { uuidShort: { contains: search } },
                { external_id: { contains: search } },
            ];
        }

        if (type === 'admin' || type === 'admin-all') {
            if (!user.root_admin) {
                // Non-admins get no results
                where.id = -1;
            } else if (type === 'admin') {
                // Only servers the admin doesn't own/subuser on
                const accessibleIds = await getAccessibleServerIds(user);
                if (accessibleIds.length > 0) {
                    where.id = { notIn: accessibleIds };
                }
            }
            // admin-all: no additional filter, show everything
        } else if (type === 'owner') {
            where.owner_id = user.id;
        } else {
            // Default: servers the user has access to
            const accessibleIds = await getAccessibleServerIds(user);
            where.id = { in: accessibleIds };
        }

        const [servers, total] = await Promise.all([
            prisma.servers.findMany({
                where,
                skip: (page - 1) * perPage,
                take: perPage,
                orderBy: { id: 'asc' },
                include: {
                    allocations: true,
                    eggs: true,
                    nodes: { include: { locations: true } },
                    server_variables: true,
                },
            }),
            prisma.servers.count({ where }),
        ]);

        // Attach the server variables with egg variable info
        for (const server of servers as any[]) {
            const eggVars = await prisma.egg_variables.findMany({
                where: { egg_id: server.egg_id },
            });

            const serverVars = await prisma.server_variables.findMany({
                where: { server_id: server.id },
            });

            const svMap = new Map(serverVars.map((sv: any) => [sv.variable_id, sv.variable_value]));

            server.variables = eggVars.map((ev: any) => ({
                ...ev,
                server_value: svMap.has(ev.id) ? svMap.get(ev.id) : null,
            }));
        }

        const transformer = new ClientServerTransformer();
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
 * Returns all the subuser permissions available on the system.
 * GET /api/client/permissions
 */
export const permissions = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        res.json({
            object: 'system_permissions',
            attributes: {
                permissions: permissionGroups,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get the server IDs the user has access to (as owner or subuser).
 */
async function getAccessibleServerIds(user: any): Promise<number[]> {
    const owned = await prisma.servers.findMany({
        where: { owner_id: user.id },
        select: { id: true },
    });

    const subuserEntries = await prisma.subusers.findMany({
        where: { user_id: user.id },
        select: { server_id: true },
    });

    const ids = new Set<number>();
    for (const s of owned) ids.add(s.id);
    for (const s of subuserEntries) ids.add(s.server_id);

    return Array.from(ids);
}
