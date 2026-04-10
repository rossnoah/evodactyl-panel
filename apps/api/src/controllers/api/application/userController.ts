import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../prisma/client.js';
import { fractal } from '../../../serializers/fractal.js';
import { UserTransformer } from '../../../transformers/application/userTransformer.js';
import { createUser } from '../../../services/users/userCreationService.js';
import { updateUser } from '../../../services/users/userUpdateService.js';
import { deleteUser } from '../../../services/users/userDeletionService.js';
import { NotFoundHttpException } from '../../../errors/index.js';
import { validateStoreUser, validateUpdateUser } from '../../../validation/schemas/user.js';

/**
 * Application API User Controller.
 * Mirrors app/Http/Controllers/Api/Application/Users/UserController.php
 * AND app/Http/Controllers/Api/Application/Users/ExternalUserController.php
 */

/**
 * GET /api/application/users
 * List all users with filtering and pagination.
 */
export async function index(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const perPage = Math.min(Math.max(parseInt(req.query['per_page'] as string) || 50, 1), 500);
    const page = Math.max(parseInt(req.query['page'] as string) || 1, 1);
    const skip = (page - 1) * perPage;

    // Build filter conditions
    const where: Record<string, any> = {};
    const filterEmail = req.query['filter[email]'] as string;
    const filterUuid = req.query['filter[uuid]'] as string;
    const filterUsername = req.query['filter[username]'] as string;
    const filterExternalId = req.query['filter[external_id]'] as string;

    if (filterEmail) where.email = { contains: filterEmail };
    if (filterUuid) where.uuid = { contains: filterUuid };
    if (filterUsername) where.username = { contains: filterUsername };
    if (filterExternalId) where.external_id = { contains: filterExternalId };

    // Build sort
    const sortParam = req.query['sort'] as string;
    let orderBy: Record<string, string> = { id: 'asc' };
    if (sortParam) {
      const desc = sortParam.startsWith('-');
      const field = desc ? sortParam.slice(1) : sortParam;
      if (['id', 'uuid'].includes(field)) {
        orderBy = { [field]: desc ? 'desc' : 'asc' };
      }
    }

    const [users, total] = await Promise.all([
      prisma.users.findMany({ where, orderBy, skip, take: perPage }),
      prisma.users.count({ where }),
    ]);

    const transformer = new UserTransformer();
    transformer.setRequest(req);

    const response = await fractal(req)
      .collection(users)
      .transformWith(transformer)
      .setPagination(total, perPage, page)
      .toArray();

    res.json(response);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/application/users/:id
 * View a single user.
 */
export async function view(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = parseInt(req.params['id'], 10);
    if (isNaN(userId)) {
      throw new NotFoundHttpException();
    }

    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundHttpException();
    }

    const transformer = new UserTransformer();
    transformer.setRequest(req);

    const response = await fractal(req)
      .item(user)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/application/users
 * Create a new user.
 */
export async function store(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = validateStoreUser(req.body);

    const user = await createUser({
      external_id: data.external_id,
      email: data.email,
      username: data.username,
      name_first: data.name_first,
      name_last: data.name_last,
      password: data.password,
      language: data.language,
      root_admin: data.root_admin,
    });

    const transformer = new UserTransformer();
    transformer.setRequest(req);

    const response = await fractal(req)
      .item(user)
      .transformWith(transformer)
      .addMeta({
        resource: `/api/application/users/${user.id}`,
      })
      .toArray();

    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/application/users/:id
 * Update an existing user.
 */
export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = parseInt(req.params['id'], 10);
    if (isNaN(userId)) {
      throw new NotFoundHttpException();
    }

    const existingUser = await prisma.users.findUnique({ where: { id: userId } });
    if (!existingUser) {
      throw new NotFoundHttpException();
    }

    const data = validateUpdateUser(req.body, userId);

    const updatedUser = await updateUser(existingUser, {
      ...(data.external_id !== undefined ? { external_id: data.external_id } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.username !== undefined ? { username: data.username } : {}),
      ...(data.name_first !== undefined ? { name_first: data.name_first } : {}),
      ...(data.name_last !== undefined ? { name_last: data.name_last } : {}),
      ...(data.password !== undefined ? { password: data.password } : {}),
      ...(data.language !== undefined ? { language: data.language } : {}),
      ...(data.root_admin !== undefined ? { root_admin: data.root_admin } : {}),
    });

    const transformer = new UserTransformer();
    transformer.setRequest(req);

    const response = await fractal(req)
      .item(updatedUser)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/application/users/:id
 * Delete a user.
 */
export async function destroy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = parseInt(req.params['id'], 10);
    if (isNaN(userId)) {
      throw new NotFoundHttpException();
    }

    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundHttpException();
    }

    await deleteUser(user);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/application/users/external/:externalId
 * Retrieve a user by their external ID.
 * Mirrors ExternalUserController.php
 */
export async function viewExternal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const externalId = req.params['externalId'];

    const user = await prisma.users.findFirst({
      where: { external_id: externalId },
    });

    if (!user) {
      throw new NotFoundHttpException();
    }

    const transformer = new UserTransformer();
    transformer.setRequest(req);

    const response = await fractal(req)
      .item(user)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  } catch (err) {
    next(err);
  }
}
