import type { Request, Response } from '@/types/express.js';
import { prisma } from '../../../prisma/client.js';
import { fractal } from '../../../serializers/fractal.js';
import {
    createDatabase,
    deleteDatabase,
    generateUniqueDatabaseName,
} from '../../../services/databases/databaseManagementService.js';
import { rotatePassword } from '../../../services/databases/databasePasswordService.js';
import { ServerDatabaseTransformer } from '../../../transformers/application/serverDatabaseTransformer.js';
import { createServerDatabaseSchema } from '../../../validation/schemas/database.js';

/**
 * Application API Database Controller (server databases).
 * Mirrors app/Http/Controllers/Api/Application/Servers/DatabaseController.php
 */
export const databaseController = {
    /**
     * Return all databases for a server.
     * GET /api/application/servers/:serverId/databases
     */
    async index(req: Request, res: Response): Promise<void> {
        const serverId = parseInt(req.params.serverId, 10);

        const server = await prisma.servers.findUniqueOrThrow({
            where: { id: serverId },
        });

        const databases = await prisma.databases.findMany({
            where: { server_id: server.id },
            orderBy: { id: 'asc' },
        });

        const transformer = ServerDatabaseTransformer.fromRequest(req);
        const response = await fractal(req).collection(databases).transformWith(transformer).toArray();

        res.json(response);
    },

    /**
     * Return a single server database.
     * GET /api/application/servers/:serverId/databases/:databaseId
     */
    async view(req: Request, res: Response): Promise<void> {
        const serverId = parseInt(req.params.serverId, 10);
        const databaseId = parseInt(req.params.databaseId, 10);

        await prisma.servers.findUniqueOrThrow({ where: { id: serverId } });

        const database = await prisma.databases.findFirstOrThrow({
            where: { id: databaseId, server_id: serverId },
        });

        const transformer = ServerDatabaseTransformer.fromRequest(req);
        const response = await fractal(req).item(database).transformWith(transformer).toArray();

        res.json(response);
    },

    /**
     * Create a new database for a server.
     * POST /api/application/servers/:serverId/databases
     */
    async store(req: Request, res: Response): Promise<void> {
        const serverId = parseInt(req.params.serverId, 10);
        const server = await prisma.servers.findUniqueOrThrow({
            where: { id: serverId },
        });

        const validated = createServerDatabaseSchema.parse(req.body);

        const database = await createDatabase(server, {
            ...validated,
            database: generateUniqueDatabaseName(validated.database, server.id),
        });

        const transformer = ServerDatabaseTransformer.fromRequest(req);
        const response = await fractal(req).item(database).transformWith(transformer).toArray();

        res.status(201).json(response);
    },

    /**
     * Reset the password for a server database.
     * POST /api/application/servers/:serverId/databases/:databaseId/reset-password
     */
    async resetPassword(req: Request, res: Response): Promise<void> {
        const serverId = parseInt(req.params.serverId, 10);
        const databaseId = parseInt(req.params.databaseId, 10);

        await prisma.servers.findUniqueOrThrow({ where: { id: serverId } });

        const database = await prisma.databases.findFirstOrThrow({
            where: { id: databaseId, server_id: serverId },
        });

        await rotatePassword(database);

        res.status(204).send();
    },

    /**
     * Delete a server database.
     * DELETE /api/application/servers/:serverId/databases/:databaseId
     */
    async delete(req: Request, res: Response): Promise<void> {
        const serverId = parseInt(req.params.serverId, 10);
        const databaseId = parseInt(req.params.databaseId, 10);

        await prisma.servers.findUniqueOrThrow({ where: { id: serverId } });

        const database = await prisma.databases.findFirstOrThrow({
            where: { id: databaseId, server_id: serverId },
        });

        await deleteDatabase(database);

        res.status(204).send();
    },
};
