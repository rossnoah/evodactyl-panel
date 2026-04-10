import { Request, Response, NextFunction } from 'express';
import { NotFoundHttpException } from '../../../../errors/index.js';

/**
 * Validate that a nested resource actually belongs to the server in the route.
 * Mirrors app/Http/Middleware/Api/Client/Server/ResourceBelongsToServer.php
 *
 * Checks that models resolved from route parameters (database, schedule, backup,
 * allocation, etc.) have a server_id matching the current server.
 */
export function resourceBelongsToServer(req: Request, _res: Response, next: NextFunction): void {
  const server = (req as any).server;
  if (!server) {
    return next(new NotFoundHttpException());
  }

  // Check each resolved model on the request
  const modelsToCheck = ['database', 'schedule', 'backup', 'allocation', 'task', 'subuser'];

  for (const modelName of modelsToCheck) {
    const model = (req as any)[modelName];
    if (model && model.server_id !== undefined && model.server_id !== server.id) {
      return next(new NotFoundHttpException());
    }
  }

  next();
}
