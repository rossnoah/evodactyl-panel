import { Request, Response, NextFunction } from 'express';
import { HttpForbiddenException } from '../../../../errors/index.js';
import { GetUserPermissionsService } from '../../../../services/servers/getUserPermissionsService.js';
import { generateWebSocketToken } from '../../../../services/nodes/nodeJwtService.js';
import * as Permissions from '../../../../permissions.js';

const permissionsService = new GetUserPermissionsService();

/**
 * Generates a one-time token for WebSocket authentication with Wings.
 * GET /api/client/servers/:server/websocket
 */
export const index = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = (req as any).server;
    const user = (req as any).user;

    // Check WebSocket permission
    const userPermissions = await permissionsService.handle(server, user);
    const hasWsPermission = userPermissions.includes('*') ||
      userPermissions.includes(Permissions.ACTION_WEBSOCKET_CONNECT);

    if (!hasWsPermission) {
      throw new HttpForbiddenException("You do not have permission to connect to this server's websocket.");
    }

    let node = server.nodes;

    // Handle transfer scenario
    if (server.transfer) {
      if (!userPermissions.includes('admin.websocket.transfer')) {
        throw new HttpForbiddenException('You do not have permission to view server transfer logs.');
      }

      // Redirect to the new node if the server has been archived
      if (server.transfer.archived && server.transfer.newNode) {
        node = server.transfer.newNode;
      }
    }

    const { token, socket } = generateWebSocketToken(
      node,
      user,
      server.uuid,
      userPermissions,
      10
    );

    res.json({
      data: {
        token,
        socket,
      },
    });
  } catch (error) {
    next(error);
  }
};
