import type { NextFunction, Request, Response } from '@/types/express.js';
import { HttpForbiddenException } from '../../../../errors/index.js';
import { prisma } from '../../../../prisma/client.js';
import { ServerConfigurationStructureService } from '../../../../services/servers/serverConfigurationStructureService.js';

const configService = new ServerConfigurationStructureService();

/**
 * Returns details about a server for the Wings daemon.
 * GET /api/remote/servers/:uuid
 */
export const view = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const node = (req as any).node;
        const uuid = req.params.uuid;

        const server = await prisma.servers.findFirstOrThrow({
            where: { uuid },
            include: {
                allocations: true,
                eggs: true,
                nodes: true,
                server_variables: true,
                mount_server: true,
            },
        });

        // Verify the requesting node has access to this server
        const transfer = await prisma.server_transfers.findFirst({
            where: {
                server_id: server.id,
                successful: null,
            },
        });

        const isValid = transfer
            ? node.id === transfer.old_node || node.id === transfer.new_node
            : node.id === server.node_id;

        if (!isValid) {
            throw new HttpForbiddenException('Requesting node does not have permission to access this server.');
        }

        // Load egg variables and merge with server variables
        const eggVars = await prisma.egg_variables.findMany({
            where: { egg_id: server.egg_id },
        });

        const serverVars = await prisma.server_variables.findMany({
            where: { server_id: server.id },
        });

        const svMap = new Map(serverVars.map((sv: any) => [sv.variable_id, sv.variable_value]));
        const variables = eggVars.map((ev: any) => ({
            ...ev,
            server_value: svMap.get(ev.id) ?? ev.default_value,
        }));

        const enrichedServer = { ...server, variables };
        const settings = await configService.handle(enrichedServer);

        res.json({
            settings,
            process_configuration: {
                // Egg configuration will be handled by EggConfigurationService in a future phase
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Lists all servers with their configurations for the requesting node.
 * GET /api/remote/servers
 */
export const list = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const node = (req as any).node;
        const perPage = Math.min(Number(req.query.per_page) || 50, 500);
        const page = Math.max(Number(req.query.page) || 1, 1);

        const [servers, total] = await Promise.all([
            prisma.servers.findMany({
                where: { node_id: node.id },
                skip: (page - 1) * perPage,
                take: perPage,
                include: {
                    allocations: true,
                    eggs: true,
                    nodes: true,
                    server_variables: true,
                    mount_server: true,
                },
            }),
            prisma.servers.count({ where: { node_id: node.id } }),
        ]);

        // Build configurations for each server
        const configurations = [];
        for (const server of servers) {
            const eggVars = await prisma.egg_variables.findMany({
                where: { egg_id: server.egg_id },
            });

            const serverVars = await prisma.server_variables.findMany({
                where: { server_id: server.id },
            });

            const svMap = new Map(serverVars.map((sv: any) => [sv.variable_id, sv.variable_value]));
            const variables = eggVars.map((ev: any) => ({
                ...ev,
                server_value: svMap.get(ev.id) ?? ev.default_value,
            }));

            const enrichedServer = { ...server, variables };
            const settings = await configService.handle(enrichedServer);

            configurations.push({
                uuid: server.uuid,
                settings,
            });
        }

        res.json({
            data: configurations,
            meta: {
                pagination: {
                    total,
                    count: configurations.length,
                    per_page: perPage,
                    current_page: page,
                    total_pages: Math.ceil(total / perPage),
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Resets the state of all servers on the node to normal.
 * POST /api/remote/servers/reset
 */
export const resetState = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const node = (req as any).node;

        // Reset servers that are in installing or restoring_backup state
        await prisma.servers.updateMany({
            where: {
                node_id: node.id,
                status: { in: ['installing', 'restoring_backup'] },
            },
            data: { status: null },
        });

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};
