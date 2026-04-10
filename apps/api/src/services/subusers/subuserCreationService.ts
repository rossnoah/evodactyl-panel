import { prisma } from '../../prisma/client.js';
import { DisplayException } from '../../errors/index.js';
import crypto from 'node:crypto';

/**
 * Service for creating subusers on a server.
 * Mirrors app/Services/Subusers/SubuserCreationService.php
 */
export class SubuserCreationService {
  /**
   * Creates a new subuser for a server, creating the user account if needed.
   */
  async handle(server: any, email: string, permissions: string[]): Promise<any> {
    // Look up user by email
    let user = await prisma.users.findFirst({
      where: { email: email.toLowerCase() },
    });

    if (user) {
      // Check if user is the server owner
      if (server.owner_id === user.id) {
        throw new DisplayException(
          'Cannot add the owner of a server as a subuser.',
          422
        );
      }

      // Check if user is already a subuser on this server
      const existingSubuser = await prisma.subusers.findFirst({
        where: {
          user_id: user.id,
          server_id: server.id,
        },
      });

      if (existingSubuser) {
        throw new DisplayException(
          'A subuser with that email address already exists for this server.',
          422
        );
      }
    } else {
      // Create a new user account
      const emailPrefix = email.split('@')[0] ?? 'user';
      const cleanPrefix = emailPrefix.replace(/[^\w.-]/g, '').substring(0, 64);
      const username = cleanPrefix + crypto.randomBytes(2).toString('hex');

      user = await prisma.users.create({
        data: {
          uuid: crypto.randomUUID(),
          email: email.toLowerCase(),
          username,
          name_first: 'Server',
          name_last: 'Subuser',
          password: crypto.randomBytes(32).toString('hex'), // Random password, user must reset
          root_admin: 0,
        },
      });
    }

    // Create the subuser record
    const uniquePermissions = [...new Set(permissions)];

    const subuser = await prisma.subusers.create({
      data: {
        user_id: user.id,
        server_id: server.id,
        permissions: JSON.stringify(uniquePermissions),
      },
    });

    // Return the subuser with user data included
    return {
      ...subuser,
      permissions: uniquePermissions,
      users: user,
    };
  }
}
