import { Request, Response, NextFunction } from 'express';
import { DaemonPowerRepository } from '../../../../repositories/wings/daemonPowerRepository.js';
import { activityFromRequest } from '../../../../services/activity/activityLogService.js';

const powerRepository = new DaemonPowerRepository();

/**
 * Send a power action to a server.
 * POST /api/client/servers/:server/power
 */
export const index = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = (req as any).server;
    const signal = req.body.signal;

    if (!signal || !['start', 'stop', 'restart', 'kill'].includes(signal)) {
      res.status(422).json({
        errors: [{ detail: 'The signal field must be one of: start, stop, restart, kill.' }],
      });
      return;
    }

    await powerRepository.setServer(server).send(signal);

    await activityFromRequest(req)
      .event(`server:power.${signal.toLowerCase()}`)
      .subject(server, 'Pterodactyl\\Models\\Server')
      .log();

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
