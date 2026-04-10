import type { NextFunction, Request, Response } from '@/types/express.js';
import { HttpForbiddenException } from '../../../../errors/index.js';
import { getWebsocketAddress } from '../../../../lib/node.js';
import * as Permissions from '../../../../permissions.js';
import { NodeJWTService } from '../../../../services/nodes/nodeJwtService.js';
import { GetUserPermissionsService } from '../../../../services/servers/getUserPermissionsService.js';

const permissionsService = new GetUserPermissionsService();

/**
 * Generates a one-time token for WebSocket authentication with Wings.
 * GET /api/client/servers/:server/websocket
 * Mirrors app/Http/Controllers/Api/Client/Servers/WebsocketController.php
 */
export const index = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const server = (req as any).server;
        const user = (req as any).user;

        const userPermissions = await permissionsService.handle(server, user);
        const hasWsPermission =
            userPermissions.includes('*') || userPermissions.includes(Permissions.ACTION_WEBSOCKET_CONNECT);

        if (!hasWsPermission) {
            throw new HttpForbiddenException("You do not have permission to connect to this server's websocket.");
        }

        let node = server.nodes;

        if (server.transfer) {
            if (!userPermissions.includes('admin.websocket.transfer')) {
                throw new HttpForbiddenException('You do not have permission to view server transfer logs.');
            }

            if (server.transfer.archived && server.transfer.newNode) {
                node = server.transfer.newNode;
            }
        }

        const token = new NodeJWTService()
            .setExpiresAt(new Date(Date.now() + 10 * 60 * 1000))
            .setUser(user)
            .setClaims({
                server_uuid: server.uuid,
                permissions: userPermissions,
            })
            .handle(node, `${user.id}${server.uuid}`);

        const socket = `${getWebsocketAddress(node)}/api/servers/${server.uuid}/ws`;

        res.json({
            data: { token, socket },
        });
    } catch (error) {
        next(error);
    }
};
