import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../prisma/client.js';
import { createApiKey, KEY_TYPE_APPLICATION } from '../../../services/api/keyCreationService.js';

/**
 * List all application API keys for the authenticated user.
 * GET /api/application/api-keys
 */
export const index = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;

    const keys = await prisma.api_keys.findMany({
      where: {
        key_type: KEY_TYPE_APPLICATION,
      },
      orderBy: { created_at: 'desc' },
      include: { users: true },
    });

    const data = keys.map((key) => ({
      object: 'api_key',
      attributes: {
        identifier: key.identifier,
        description: key.memo,
        allowed_ips: key.allowed_ips ? JSON.parse(key.allowed_ips) : [],
        r_servers: key.r_servers,
        r_nodes: key.r_nodes,
        r_allocations: key.r_allocations,
        r_users: key.r_users,
        r_locations: key.r_locations,
        r_nests: key.r_nests,
        r_eggs: key.r_eggs,
        r_database_hosts: key.r_database_hosts,
        r_server_databases: key.r_server_databases,
        last_used_at: key.last_used_at,
        created_at: key.created_at,
        created_by: key.users ? {
          id: key.users.id,
          email: key.users.email,
          username: key.users.username,
        } : null,
      },
    }));

    res.json({ object: 'list', data });
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new application API key.
 * POST /api/application/api-keys
 */
export const store = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;

    const permissions: Record<string, number> = {};
    const permKeys = [
      'r_servers', 'r_nodes', 'r_allocations', 'r_users',
      'r_locations', 'r_nests', 'r_eggs', 'r_database_hosts', 'r_server_databases',
    ];
    for (const key of permKeys) {
      if (req.body[key] !== undefined) {
        permissions[key] = Number(req.body[key]);
      }
    }

    const { apiKey, plainTextToken } = await createApiKey(
      {
        user_id: user.id,
        memo: req.body.description || '',
        allowed_ips: req.body.allowed_ips || [],
      },
      KEY_TYPE_APPLICATION,
      permissions,
    );

    res.status(201).json({
      object: 'api_key',
      attributes: {
        identifier: apiKey.identifier,
        description: apiKey.memo,
        allowed_ips: apiKey.allowed_ips ? JSON.parse(apiKey.allowed_ips) : [],
        r_servers: apiKey.r_servers,
        r_nodes: apiKey.r_nodes,
        r_allocations: apiKey.r_allocations,
        r_users: apiKey.r_users,
        r_locations: apiKey.r_locations,
        r_nests: apiKey.r_nests,
        r_eggs: apiKey.r_eggs,
        r_database_hosts: apiKey.r_database_hosts,
        r_server_databases: apiKey.r_server_databases,
        last_used_at: apiKey.last_used_at,
        created_at: apiKey.created_at,
      },
      meta: {
        secret_token: plainTextToken,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete an application API key.
 * DELETE /api/application/api-keys/:identifier
 */
export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const identifier = req.params.identifier;

    await prisma.api_keys.deleteMany({
      where: {
        identifier,
        key_type: KEY_TYPE_APPLICATION,
      },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
