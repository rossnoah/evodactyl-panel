import { prisma } from '../../prisma/client.js';

/**
 * Service to get the server-specific permissions for a user.
 * Mirrors app/Services/Servers/GetUserPermissionsService.php
 */
export class GetUserPermissionsService {
  /**
   * Returns the server-specific permissions that a user has.
   * Checks if they are an admin, the server owner, or a subuser.
   */
  async handle(server: any, user: any): Promise<string[]> {
    if (user.root_admin || user.id === server.owner_id) {
      const permissions = ['*'];

      if (user.root_admin) {
        permissions.push('admin.websocket.errors');
        permissions.push('admin.websocket.install');
        permissions.push('admin.websocket.transfer');
      }

      return permissions;
    }

    const subuser = await prisma.subusers.findFirst({
      where: {
        server_id: server.id,
        user_id: user.id,
      },
    });

    if (subuser && subuser.permissions) {
      // permissions is stored as JSON in the database
      const perms = typeof subuser.permissions === 'string'
        ? JSON.parse(subuser.permissions)
        : subuser.permissions;
      return Array.isArray(perms) ? perms : [];
    }

    return [];
  }
}
