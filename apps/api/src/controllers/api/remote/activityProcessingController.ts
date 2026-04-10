import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../prisma/client.js';

/**
 * Process activity events sent from the Wings daemon.
 * POST /api/remote/activity
 */
export const index = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const node = (req as any).node;
    const data = req.body.data;

    if (!Array.isArray(data)) {
      res.status(422).json({ errors: [{ detail: 'The data field must be an array.' }] });
      return;
    }

    // Get all server UUIDs and user UUIDs referenced in the events
    const serverUuids = [...new Set(data.map((d: any) => d.server).filter(Boolean))];
    const userUuids = [...new Set(data.map((d: any) => d.user).filter(Boolean))];

    // Load servers belonging to this node
    const servers = await prisma.servers.findMany({
      where: {
        uuid: { in: serverUuids as string[] },
        node_id: node.id,
      },
    });
    const serverMap = new Map(servers.map((s: any) => [s.uuid, s]));

    // Load users
    const users = userUuids.length > 0
      ? await prisma.users.findMany({
        where: { uuid: { in: userUuids as string[] } },
      })
      : [];
    const userMap = new Map(users.map((u: any) => [u.uuid, u]));

    // Group logs by server
    const logsByServer = new Map<string, any[]>();

    for (const datum of data) {
      const server = serverMap.get(datum.server);
      if (!server || !datum.event?.startsWith('server:')) {
        continue;
      }

      let timestamp: Date;
      try {
        // Parse RFC3339 timestamp, stripping sub-second precision if needed
        const cleaned = datum.timestamp.replace(/(\.\d+)Z$/, 'Z');
        timestamp = new Date(cleaned);
        if (isNaN(timestamp.getTime())) {
          timestamp = new Date();
        }
      } catch {
        timestamp = new Date();
      }

      const log: any = {
        ip: datum.ip || '127.0.0.1',
        event: datum.event,
        properties: JSON.stringify(datum.metadata ?? {}),
        timestamp,
      };

      const user = userMap.get(datum.user);
      if (user) {
        log.actor_id = BigInt(user.id);
        log.actor_type = 'Pterodactyl\\Models\\User';
      }

      if (!logsByServer.has(datum.server)) {
        logsByServer.set(datum.server, []);
      }
      logsByServer.get(datum.server)!.push(log);
    }

    // Insert activity logs and their subjects
    for (const [serverUuid, logs] of logsByServer) {
      const server = serverMap.get(serverUuid);
      if (!server) continue;

      for (const log of logs) {
        const activityLog = await prisma.activity_logs.create({
          data: log,
        });

        await prisma.activity_log_subjects.create({
          data: {
            activity_log_id: activityLog.id,
            subject_id: BigInt(server.id),
            subject_type: 'Pterodactyl\\Models\\Server',
          },
        });
      }
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
