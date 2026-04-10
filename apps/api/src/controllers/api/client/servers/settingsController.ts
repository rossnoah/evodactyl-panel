import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../../prisma/client.js';
import { ReinstallServerService } from '../../../../services/servers/reinstallServerService.js';
import { BadRequestHttpException } from '../../../../errors/index.js';
import { activityFromRequest } from '../../../../services/activity/activityLogService.js';

const reinstallService = new ReinstallServerService();

/**
 * Renames a server.
 * POST /api/client/servers/:server/settings/rename
 */
export const rename = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = (req as any).server;
    const name = req.body.name;
    const description = req.body.description !== undefined
      ? String(req.body.description)
      : server.description;

    if (!name || typeof name !== 'string') {
      res.status(422).json({
        errors: [{ detail: 'The name field is required.' }],
      });
      return;
    }

    await prisma.servers.update({
      where: { id: server.id },
      data: { name, description },
    });

    if (server.name !== name) {
      await activityFromRequest(req)
        .event('server:settings.rename')
        .property({ old: server.name, new: name })
        .subject(server, 'Pterodactyl\\Models\\Server')
        .log();
    }

    if (server.description !== description) {
      await activityFromRequest(req)
        .event('server:settings.description')
        .property({ old: server.description, new: description })
        .subject(server, 'Pterodactyl\\Models\\Server')
        .log();
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Reinstalls the server on the daemon.
 * POST /api/client/servers/:server/settings/reinstall
 */
export const reinstall = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = (req as any).server;

    await reinstallService.handle(server);

    await activityFromRequest(req)
      .event('server:reinstall')
      .subject(server, 'Pterodactyl\\Models\\Server')
      .log();

    res.status(202).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Changes the Docker image in use by the server.
 * PUT /api/client/servers/:server/settings/docker-image
 */
export const dockerImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = (req as any).server;
    const newImage = req.body.docker_image;

    if (!newImage || typeof newImage !== 'string') {
      res.status(422).json({
        errors: [{ detail: 'The docker_image field is required.' }],
      });
      return;
    }

    // Only allow changing to images defined in the egg
    const egg = server.eggs;
    const allowedImages = egg?.docker_images ? Object.values(egg.docker_images) : [];

    if (!allowedImages.includes(server.image)) {
      throw new BadRequestHttpException(
        "This server's Docker image has been manually set by an administrator and cannot be updated."
      );
    }

    if (!allowedImages.includes(newImage)) {
      throw new BadRequestHttpException('The specified Docker image is not allowed for this server.');
    }

    const original = server.image;

    await prisma.servers.update({
      where: { id: server.id },
      data: { image: newImage },
    });

    if (original !== newImage) {
      await activityFromRequest(req)
        .event('server:startup.image')
        .property({ old: original, new: newImage })
        .subject(server, 'Pterodactyl\\Models\\Server')
        .log();
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
