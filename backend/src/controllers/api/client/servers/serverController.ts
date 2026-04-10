import { Request, Response, NextFunction } from 'express';
import { fractal } from '../../../../serializers/fractal.js';
import { ClientServerTransformer } from '../../../../transformers/client/serverTransformer.js';
import { GetUserPermissionsService } from '../../../../services/servers/getUserPermissionsService.js';

const permissionsService = new GetUserPermissionsService();

/**
 * Transform an individual server into a response for the client API.
 * GET /api/client/servers/:server
 */
export const index = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = (req as any).server;
    const user = (req as any).user;

    const userPermissions = await permissionsService.handle(server, user);

    const transformer = new ClientServerTransformer();
    transformer.setRequest(req);

    const response = await fractal(req)
      .item(server)
      .transformWith(transformer)
      .addMeta({
        is_server_owner: user.id === server.owner_id,
        user_permissions: userPermissions,
      })
      .toArray();

    res.json(response);
  } catch (error) {
    next(error);
  }
};
