import type { Request, Response } from '@/types/express.js';
import { ModelNotFoundException } from '../../../../errors/index.js';
import { decodeHashid } from '../../../../lib/hashids.js';
import { prisma } from '../../../../prisma/client.js';
import { fractal } from '../../../../serializers/fractal.js';
import { activityFromRequest } from '../../../../services/activity/activityLogService.js';
import { deleteDatabase } from '../../../../services/databases/databaseManagementService.js';
import { rotatePassword } from '../../../../services/databases/databasePasswordService.js';
import { deployServerDatabase } from '../../../../services/databases/deployServerDatabaseService.js';
import { DatabaseTransformer } from '../../../../transformers/client/databaseTransformer.js';
import { createClientDatabaseSchema } from '../../../../validation/schemas/database.js';

/**
 * Client API Database Controller.
 * Mirrors app/Http/Controllers/Api/Client/Servers/DatabaseController.php
 */
export const clientDatabaseController = {
    /**
     * Return all databases for the server.
     * GET /api/client/servers/:server/databases
     */
    async index(req: Request, res: Response): Promise<void> {
        const server = (req as any).server;

        const databases = await prisma.databases.findMany({
            where: { server_id: server.id },
            include: { database_hosts: true },
            orderBy: { id: 'asc' },
        });

        const transformer = DatabaseTransformer.fromRequest(req) as DatabaseTransformer;
        const response = await fractal(req).collection(databases).transformWith(transformer).toArray();

        res.json(response);
    },

    /**
     * Create a new database for the server.
     * POST /api/client/servers/:server/databases
     */
    async store(req: Request, res: Response): Promise<void> {
        const server = (req as any).server;

        const validated = createClientDatabaseSchema.parse(req.body);

        // Limit enforcement happens inside `deployServerDatabase` under a
        // transaction with a row lock on the server, so concurrent requests
        // cannot race past `server.database_limit`.
        const database = await deployServerDatabase(server, validated);

        // Log activity
        await activityFromRequest(req)
            .event('server:database.create')
            .subject(database, 'Pterodactyl\\Models\\Database')
            .property('name', database.database)
            .log();

        const transformer = DatabaseTransformer.fromRequest(req) as DatabaseTransformer;
        const response = await fractal(req)
            .parseIncludes(['password'])
            .item(database)
            .transformWith(transformer)
            .toArray();

        res.json(response);
    },

    /**
     * Rotate the password for a database.
     * POST /api/client/servers/:server/databases/:database/rotate-password
     */
    async rotatePassword(req: Request, res: Response): Promise<void> {
        const server = (req as any).server;
        const databaseHashId = req.params.database;

        const databaseId = decodeHashid(databaseHashId);
        if (databaseId === undefined) {
            throw new ModelNotFoundException();
        }

        const database = await prisma.databases.findFirstOrThrow({
            where: { id: databaseId, server_id: server.id },
        });

        await rotatePassword(database);

        // Log activity
        await activityFromRequest(req)
            .event('server:database.rotate-password')
            .subject(database, 'Pterodactyl\\Models\\Database')
            .property('name', database.database)
            .log();

        // Refresh the database record after password rotation
        const refreshed = await prisma.databases.findUniqueOrThrow({
            where: { id: databaseId },
        });

        const transformer = DatabaseTransformer.fromRequest(req) as DatabaseTransformer;
        const response = await fractal(req)
            .parseIncludes(['password'])
            .item(refreshed)
            .transformWith(transformer)
            .toArray();

        res.json(response);
    },

    /**
     * Delete a database.
     * DELETE /api/client/servers/:server/databases/:database
     */
    async delete(req: Request, res: Response): Promise<void> {
        const server = (req as any).server;
        const databaseHashId = req.params.database;

        const databaseId = decodeHashid(databaseHashId);
        if (databaseId === undefined) {
            throw new ModelNotFoundException();
        }

        const database = await prisma.databases.findFirstOrThrow({
            where: { id: databaseId, server_id: server.id },
        });

        await deleteDatabase(database);

        // Log activity
        await activityFromRequest(req)
            .event('server:database.delete')
            .subject({ id: database.id }, 'Pterodactyl\\Models\\Database')
            .property('name', database.database)
            .log();

        res.status(204).send();
    },
};
