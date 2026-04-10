import { Request, Response, NextFunction } from 'express';
import { DaemonCommandRepository } from '../../../../repositories/wings/daemonCommandRepository.js';
import { DaemonConnectionException } from '../../../../errors/index.js';
import { activityFromRequest } from '../../../../services/activity/activityLogService.js';

const commandRepository = new DaemonCommandRepository();

/**
 * Send a command to a running server.
 * POST /api/client/servers/:server/command
 */
export const index = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = (req as any).server;
    const command = req.body.command;

    if (!command || typeof command !== 'string') {
      res.status(422).json({
        errors: [{ detail: 'The command field is required.' }],
      });
      return;
    }

    try {
      await commandRepository.setServer(server).send(command);
    } catch (error) {
      if (error instanceof DaemonConnectionException) {
        // If the daemon returns a 502, the server is likely offline
        if ((error as any).statusCode === 502) {
          res.status(502).json({
            errors: [{ detail: 'Server must be online in order to send commands.' }],
          });
          return;
        }
      }
      throw error;
    }

    await activityFromRequest(req)
      .event('server:console.command')
      .property('command', command)
      .subject(server, 'Pterodactyl\\Models\\Server')
      .log();

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
