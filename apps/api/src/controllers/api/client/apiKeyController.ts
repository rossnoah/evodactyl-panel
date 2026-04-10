import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../prisma/client.js';
import { fractal } from '../../../serializers/fractal.js';
import { ApiKeyTransformer } from '../../../transformers/client/apiKeyTransformer.js';
import { createApiKey, KEY_TYPE_ACCOUNT } from '../../../services/api/keyCreationService.js';
import { activityFromRequest } from '../../../services/activity/activityLogService.js';
import { DisplayException, NotFoundHttpException, ValidationException } from '../../../errors/index.js';

/**
 * Client API Key Controller.
 * Mirrors app/Http/Controllers/Api/Client/ApiKeyController.php
 */

/**
 * GET /api/client/account/api-keys
 * Return all API keys for the authenticated user.
 */
export async function index(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as any).user;

    const keys = await prisma.api_keys.findMany({
      where: {
        user_id: user.id,
        key_type: KEY_TYPE_ACCOUNT,
      },
    });

    const transformer = new ApiKeyTransformer();
    transformer.setRequest(req);

    const response = await fractal(req)
      .collection(keys)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/client/account/api-keys
 * Create a new API key for the authenticated user.
 */
export async function store(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as any).user;

    // Validate input
    const { description, allowed_ips } = req.body;

    if (!description || typeof description !== 'string') {
      throw new ValidationException([
        { sourceField: 'description', rule: 'required', detail: 'The description field is required.' },
      ]);
    }

    // Check key limit
    const existingKeyCount = await prisma.api_keys.count({
      where: {
        user_id: user.id,
        key_type: KEY_TYPE_ACCOUNT,
      },
    });

    if (existingKeyCount >= 25) {
      throw new DisplayException('You have reached the account limit for number of API keys.');
    }

    const { apiKey, plainTextToken } = await createApiKey(
      {
        user_id: user.id,
        memo: description,
        allowed_ips: Array.isArray(allowed_ips) ? allowed_ips : [],
      },
      KEY_TYPE_ACCOUNT
    );

    await activityFromRequest(req)
      .event('user:api-key.create')
      .property('identifier', apiKey.identifier)
      .log();

    const transformer = new ApiKeyTransformer();
    transformer.setRequest(req);

    const response = await fractal(req)
      .item(apiKey)
      .transformWith(transformer)
      .addMeta({ secret_token: plainTextToken })
      .toArray();

    res.json(response);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/client/account/api-keys/:identifier
 * Delete an API key.
 */
export async function destroy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as any).user;
    const identifier = req.params['identifier'];

    const key = await prisma.api_keys.findFirst({
      where: {
        user_id: user.id,
        key_type: KEY_TYPE_ACCOUNT,
        identifier,
      },
    });

    if (!key) {
      throw new NotFoundHttpException();
    }

    await activityFromRequest(req)
      .event('user:api-key.delete')
      .property('identifier', key.identifier)
      .log();

    await prisma.api_keys.delete({
      where: { id: key.id },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
