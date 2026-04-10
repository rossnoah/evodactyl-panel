import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../../prisma/client.js';
import {
  NotFoundHttpException,
  ServerStateConflictException,
  AuthenticationException,
} from '../../../../errors/index.js';

/**
 * Authenticate that the user has access to the specified server.
 * Mirrors app/Http/Middleware/Api/Client/Server/AuthenticateServerAccess.php
 *
 * Validates:
 * 1. Server exists and is identified by uuid or uuidShort
 * 2. User is the owner, a subuser, or a root admin
 * 3. Server is not in an invalid state (suspended, installing, etc.)
 */
export async function authenticateServerAccess(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const user = (req as any).user;
  if (!user) {
    return next(new AuthenticationException());
  }

  const serverIdentifier = req.params.server;
  if (!serverIdentifier) {
    return next(new NotFoundHttpException());
  }

  // Find server by uuid or uuidShort
  const server = await prisma.servers.findFirst({
    where: {
      OR: [
        { uuid: serverIdentifier },
        { uuidShort: serverIdentifier },
      ],
    },
    include: {
      allocations: {
        where: { id: undefined }, // Will be resolved by Prisma to the default allocation
      },
    },
  });

  if (!server) {
    return next(new NotFoundHttpException());
  }

  // Check user access: owner, subuser, or root admin
  const isOwner = server.owner_id === user.id;
  const isAdmin = Boolean(user.root_admin);

  let subuser = null;
  if (!isOwner && !isAdmin) {
    subuser = await prisma.subusers.findFirst({
      where: {
        server_id: server.id,
        user_id: user.id,
      },
    });

    if (!subuser) {
      return next(new NotFoundHttpException());
    }
  }

  // Check server state
  if (server.status === 'suspended' && !isAdmin) {
    return next(new ServerStateConflictException(
      'This server is currently suspended and the functionality requested is unavailable.'
    ));
  }

  if (
    (server.status === 'installing' || server.status === 'install_failed' || server.status === 'reinstall_failed') &&
    !isAdmin
  ) {
    return next(new ServerStateConflictException(
      'This server has not yet completed its installation process.'
    ));
  }

  // Attach to request
  (req as any).server = server;
  (req as any).isServerOwner = isOwner;
  if (subuser) {
    (req as any).subuser = subuser;
  }

  next();
}
