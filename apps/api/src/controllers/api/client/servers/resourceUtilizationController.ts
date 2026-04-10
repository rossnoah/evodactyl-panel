import { Request, Response, NextFunction } from 'express';
import { fractal } from '../../../../serializers/fractal.js';
import { StatsTransformer } from '../../../../transformers/client/statsTransformer.js';
import { DaemonServerRepository } from '../../../../repositories/wings/daemonServerRepository.js';

const serverRepository = new DaemonServerRepository();

// Simple in-memory cache for resource stats
const cache = new Map<string, { data: any; expires: number }>();

/**
 * Return the current resource utilization for a server.
 * GET /api/client/servers/:server/resources
 */
export const index = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = (req as any).server;
    const cacheKey = `resources:${server.uuid}`;

    // Check cache (20 second TTL)
    const cached = cache.get(cacheKey);
    let stats: any;

    if (cached && cached.expires > Date.now()) {
      stats = cached.data;
    } else {
      stats = await serverRepository.setServer(server).getDetails();
      cache.set(cacheKey, { data: stats, expires: Date.now() + 20000 });
    }

    const transformer = new StatsTransformer();
    transformer.setRequest(req);

    const response = await fractal(req)
      .item(stats)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  } catch (error) {
    next(error);
  }
};
