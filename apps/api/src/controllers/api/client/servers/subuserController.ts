import type { Request, Response } from '@/types/express.js';
import { AuthorizationException, NotFoundHttpException } from '../../../../errors/index.js';
import {
    ACTION_USER_CREATE,
    ACTION_USER_DELETE,
    ACTION_USER_READ,
    ACTION_USER_UPDATE,
    ACTION_WEBSOCKET_CONNECT,
    permissionGroups,
} from '../../../../permissions.js';
import { prisma } from '../../../../prisma/client.js';
import { fractal } from '../../../../serializers/fractal.js';
import { activityFromRequest } from '../../../../services/activity/activityLogService.js';
import { SubuserCreationService } from '../../../../services/subusers/subuserCreationService.js';
import { SubuserTransformer } from '../../../../transformers/client/subuserTransformer.js';

/**
 * Subuser controller for the client API.
 * Mirrors app/Http/Controllers/Api/Client/Servers/SubuserController.php
 */
export class SubuserController {
    /**
     * Return the users associated with this server instance.
     */
    async index(req: Request, res: Response): Promise<void> {
        const server = (req as any).server;
        const user = (req as any).user;

        if (!this.hasPermission(user, server, ACTION_USER_READ)) {
            throw new AuthorizationException();
        }

        const subusers = await prisma.subusers.findMany({
            where: { server_id: server.id },
            include: { users: true },
        });

        // Parse JSON permissions
        const parsed = subusers.map((s: any) => ({
            ...s,
            permissions: typeof s.permissions === 'string' ? JSON.parse(s.permissions) : s.permissions,
        }));

        const transformer = new SubuserTransformer();
        transformer.setRequest(req);

        const response = await fractal(req).collection(parsed).transformWith(transformer).toArray();

        res.json(response);
    }

    /**
     * Returns a single subuser associated with this server instance.
     */
    async view(req: Request, res: Response): Promise<void> {
        const server = (req as any).server;
        const user = (req as any).user;

        if (!this.hasPermission(user, server, ACTION_USER_READ)) {
            throw new AuthorizationException();
        }

        const subuser = await this.getSubuser(req.params.user!, server.id);

        const parsed = {
            ...subuser,
            permissions:
                typeof subuser.permissions === 'string' ? JSON.parse(subuser.permissions) : subuser.permissions,
        };

        const transformer = new SubuserTransformer();
        transformer.setRequest(req);

        const response = await fractal(req).item(parsed).transformWith(transformer).toArray();

        res.json(response);
    }

    /**
     * Create a new subuser for the given server.
     */
    async store(req: Request, res: Response): Promise<void> {
        const server = (req as any).server;
        const user = (req as any).user;

        if (!this.hasPermission(user, server, ACTION_USER_CREATE)) {
            throw new AuthorizationException();
        }

        const permissions = this.getDefaultPermissions(req);

        const creationService = new SubuserCreationService();
        const subuser = await creationService.handle(server, req.body.email, permissions);

        await activityFromRequest(req)
            .event('server:subuser.create')
            .subject(subuser.users, 'User')
            .property({ email: req.body.email, permissions })
            .log();

        const transformer = new SubuserTransformer();
        transformer.setRequest(req);

        const response = await fractal(req).item(subuser).transformWith(transformer).toArray();

        res.json(response);
    }

    /**
     * Update a given subuser in the system for the server.
     */
    async update(req: Request, res: Response): Promise<void> {
        const server = (req as any).server;
        const user = (req as any).user;

        if (!this.hasPermission(user, server, ACTION_USER_UPDATE)) {
            throw new AuthorizationException();
        }

        const subuser = await this.getSubuser(req.params.user!, server.id);

        const permissions = this.getDefaultPermissions(req);
        const current = typeof subuser.permissions === 'string' ? JSON.parse(subuser.permissions) : subuser.permissions;

        const sortedNew = [...permissions].sort();
        const sortedCurrent = [...current].sort();

        // Only update if permissions have actually changed
        if (JSON.stringify(sortedNew) !== JSON.stringify(sortedCurrent)) {
            await prisma.subusers.update({
                where: { id: subuser.id },
                data: { permissions: JSON.stringify(permissions) },
            });
        }

        await activityFromRequest(req)
            .event('server:subuser.update')
            .subject(subuser.users, 'User')
            .property({
                email: subuser.users.email,
                old: current,
                new: permissions,
                revoked: true,
            })
            .log();

        // Reload the subuser
        const updated = await prisma.subusers.findUnique({
            where: { id: subuser.id },
            include: { users: true },
        });

        const parsed = {
            ...updated,
            permissions:
                typeof updated!.permissions === 'string' ? JSON.parse(updated!.permissions) : updated!.permissions,
        };

        const transformer = new SubuserTransformer();
        transformer.setRequest(req);

        const response = await fractal(req).item(parsed).transformWith(transformer).toArray();

        res.json(response);
    }

    /**
     * Removes a subuser from a server's assignment.
     */
    async delete(req: Request, res: Response): Promise<void> {
        const server = (req as any).server;
        const user = (req as any).user;

        if (!this.hasPermission(user, server, ACTION_USER_DELETE)) {
            throw new AuthorizationException();
        }

        const subuser = await this.getSubuser(req.params.user!, server.id);

        await prisma.subusers.delete({ where: { id: subuser.id } });

        await activityFromRequest(req)
            .event('server:subuser.delete')
            .subject(subuser.users, 'User')
            .property('email', subuser.users.email)
            .property('revoked', true)
            .log();

        res.status(204).json();
    }

    /**
     * Get a subuser by user UUID, including user data.
     */
    private async getSubuser(userUuid: string, serverId: number): Promise<any> {
        const user = await prisma.users.findFirst({
            where: { uuid: userUuid },
        });

        if (!user) {
            throw new NotFoundHttpException('The requested subuser could not be found.');
        }

        const subuser = await prisma.subusers.findFirst({
            where: {
                user_id: user.id,
                server_id: serverId,
            },
            include: { users: true },
        });

        if (!subuser) {
            throw new NotFoundHttpException('The requested subuser could not be found.');
        }

        return subuser;
    }

    /**
     * Returns the default permissions for subusers, filtering out invalid permissions.
     */
    private getDefaultPermissions(req: Request): string[] {
        // Build list of all valid permissions
        const allowed: string[] = [];
        for (const [prefix, data] of Object.entries(permissionGroups)) {
            for (const key of Object.keys(data.keys)) {
                allowed.push(`${prefix}.${key}`);
            }
        }

        const requested: string[] = req.body.permissions ?? [];
        const cleaned = requested.filter((p: string) => allowed.includes(p));

        // Always include websocket.connect
        return [...new Set([...cleaned, ACTION_WEBSOCKET_CONNECT])];
    }

    private hasPermission(user: any, server: any, permission: string): boolean {
        if (user.root_admin) return true;
        if (server.owner_id === user.id) return true;
        const subuser = (user as any).subuser;
        if (subuser && Array.isArray(subuser.permissions)) {
            return subuser.permissions.includes(permission);
        }
        return false;
    }
}

export const subuserController = new SubuserController();
