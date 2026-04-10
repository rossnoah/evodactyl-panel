import type { NextFunction, Request, Response } from '@/types/express.js';
import { prisma } from '../../../prisma/client.js';
import { fractal } from '../../../serializers/fractal.js';
import { ActivityLogTransformer } from '../../../transformers/client/activityLogTransformer.js';

/**
 * Client Account Activity Log Controller.
 * Mirrors app/Http/Controllers/Api/Client/ActivityLogController.php
 */

const DISABLED_EVENTS = ['server:file.upload'];

/**
 * GET /api/client/account/activity
 * Returns a paginated set of the user's activity logs.
 */
export async function accountActivityLog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const user = (req as any).user;

        const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
        const perPage = Math.min(500, Math.max(1, parseInt(req.query.per_page as string, 10) || 25));

        const where: any = {
            actor_type: 'Pterodactyl\\Models\\User',
            actor_id: user.id,
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
