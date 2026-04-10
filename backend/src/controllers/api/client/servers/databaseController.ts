import { Request, Response } from 'express';
import { prisma } from '../../../../prisma/client.js';
import { fractal } from '../../../../serializers/fractal.js';
import { DatabaseTransformer } from '../../../../transformers/client/databaseTransformer.js';
import { deployServerDatabase } from '../../../../services/databases/deployServerDatabaseService.js';
import { deleteDatabase } from '../../../../services/databases/databaseManagementService.js';
import { rotatePassword } from '../../../../services/databases/databasePasswordService.js';
import { activityFromRequest } from '../../../../services/activity/activityLogService.js';
import { decodeHashid } from '../../../../lib/hashids.js';
import { createClientDatabaseSchema } from '../../../../validation/schemas/database.js';
import { DisplayException, ModelNotFoundException } from '../../../../errors/index.js';

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
    const response = await fractal(req)
      .collection(databases)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  },

  /**
   * Create a new database for the server.
   * POST /api/client/servers/:server/databases
   */
  async store(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;

    const validated = createClientDatabaseSchema.parse(req.body);

    // Check database limit
    const currentCount = await prisma.databases.count({
      where: { server_id: server.id },
    });

    if (server.database_limit !== null && currentCount >= server.database_limit) {
      throw new DisplayException('Cannot create additional databases on this server: limit has been reached.', 400);
    }

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
