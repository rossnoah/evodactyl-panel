import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../../prisma/client.js';
import { fractal } from '../../../../serializers/fractal.js';
import { ActivityLogTransformer } from '../../../../transformers/client/activityLogTransformer.js';
import { ACTION_ACTIVITY_READ } from '../../../../permissions.js';
import { AuthorizationException } from '../../../../errors/index.js';

/**
 * Server Activity Log Controller.
 * Mirrors app/Http/Controllers/Api/Client/Servers/ActivityLogController.php
 */

const DISABLED_EVENTS = ['server:file.upload'];

/**
 * Check if a user has a specific permission on the server.
 */
function hasPermission(user: any, server: any, permission: string): boolean {
  if (user.root_admin) return true;
  if (server.owner_id === user.id) return true;

  const subuser = (user as any).subuser;
  if (subuser && Array.isArray(subuser.permissions)) {
    return subuser.permissions.includes(permission);
  }

  return false;
}

/**
 * GET /api/client/servers/:server/activity
 * Returns the activity logs for a server.
 */
export async function serverActivityLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as any).user;
    const server = (req as any).server;

    if (!hasPermission(user, server, ACTION_ACTIVITY_READ)) {
      throw new AuthorizationException();
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const perPage = Math.min(500, Math.max(1, parseInt(req.query.per_page as string, 10) || 25));

    // Find activity logs linked to this server through activity_log_subjects
    const subjectEntries = await prisma.activity_log_subjects.findMany({
      where: {
        subject_type: 'Pterodactyl\\Models\\Server',
        subject_id: server.id,
      },
      select: { activity_log_id: true },
    });

    const activityLogIds = subjectEntries.map((e: any) => e.activity_log_id);

    const where: any = {
      id: { in: activityLogIds },
      event: { notIn: DISABLED_EVENTS },
    };

    // Support filtering by event (partial match)
    const eventFilter = req.query['filter[event]'] as string;
    if (eventFilter) {
      where.event = {
        ...where.event,
        contains: eventFilter,
      };
    }

    const [logs, total] = await Promise.all([
      prisma.activity_logs.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.activity_logs.count({ where }),
    ]);

    const transformer = new ActivityLogTransformer();
    transformer.setRequest(req);

    const response = await fractal(req)
      .collection(logs)
      .transformWith(transformer)
      .setPagination(total, perPage, page)
      .toArray();

    res.json(response);
  } catch (err) {
    next(err);
  }
}
