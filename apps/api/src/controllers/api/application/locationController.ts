import type { NextFunction, Request, Response } from '@/types/express.js';
import { prisma } from '../../../prisma/client.js';
import { fractal } from '../../../serializers/fractal.js';
import { createLocation } from '../../../services/locations/locationCreationService.js';
import { deleteLocation } from '../../../services/locations/locationDeletionService.js';
import { updateLocation } from '../../../services/locations/locationUpdateService.js';
import { LocationTransformer } from '../../../transformers/application/locationTransformer.js';
import { validateStoreLocation, validateUpdateLocation } from '../../../validation/schemas/location.js';

/**
 * Builds a Prisma `where` clause from ?filter[field]=value query params for locations.
 */
function buildLocationFilters(query: Record<string, any>): Record<string, any> {
    const where: Record<string, any> = {};
    const filter = query.filter;
    if (filter && typeof filter === 'object') {
        if (filter.short) where.short = { contains: filter.short };
        if (filter.long) where.long = { contains: filter.long };
    }
    return where;
}

function buildLocationSort(query: Record<string, any>): Record<string, 'asc' | 'desc'> | undefined {
    const sort = query.sort;
    if (typeof sort !== 'string') return undefined;

    const desc = sort.startsWith('-');
    const field = desc ? sort.slice(1) : sort;
    const allowed = ['id'];
    if (!allowed.includes(field)) return undefined;

    return { [field]: desc ? 'desc' : 'asc' };
}

/**
 * List all locations.
 * GET /api/application/locations
 */
export const index = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string, 10) || 1;
        const perPage = parseInt(req.query.per_page as string, 10) || 50;
        const where = buildLocationFilters(req.query as any);
        const orderBy = buildLocationSort(req.query as any);

        const [locations, total] = await Promise.all([
            prisma.locations.findMany({
                where,
                orderBy,
                skip: (page - 1) * perPage,
                take: perPage,
            }),
            prisma.locations.count({ where }),
        ]);

        const transformer = LocationTransformer.fromRequest(req);
        const response = await fractal(req)
            .collection(locations)
            .transformWith(transformer)
            .setPagination(total, perPage, page)
            .toArray();

        res.json(response);
    } catch (err) {
        next(err);
    }
};

/**
 * View a single location.
 * GET /api/application/locations/:id
 */
export const view = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const locationId = parseInt(req.params.id, 10);
        const location = await prisma.locations.findUnique({ where: { id: locationId } });

        if (!location) {
            res.status(404).json({ error: 'Location not found.' });
            return;
        }

        const transformer = LocationTransformer.fromRequest(req);
        const response = await fractal(req).item(location).transformWith(transformer).toArray();

        res.json(response);
    } catch (err) {
        next(err);
    }
};

/**
 * Create a new location.
 * POST /api/application/locations
 */
export const store = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const validated = validateStoreLocation(req.body);
        const created = await createLocation(validated);

        // Re-fetch to get DB-generated timestamps (Prisma create may not return them)
        const location = await prisma.locations.findUnique({ where: { id: created.id } });

        const transformer = LocationTransformer.fromRequest(req);
        const response = await fractal(req)
            .item(location)
            .transformWith(transformer)
            .addMeta({
                resource: `${req.protocol}://${req.get('host')}/api/application/locations/${location!.id}`,
            })
            .toArray();

        res.status(201).json(response);
    } catch (err) {
        next(err);
    }
};

/**
 * Update an existing location.
 * PATCH /api/application/locations/:id
 */
export const update = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const locationId = parseInt(req.params.id, 10);
        const existing = await prisma.locations.findUnique({ where: { id: locationId } });
        if (!existing) {
            res.status(404).json({ error: 'Location not found.' });
            return;
        }

        const validated = validateUpdateLocation(req.body);
        const location = await updateLocation(locationId, validated);

        const transformer = LocationTransformer.fromRequest(req);
        const response = await fractal(req).item(location).transformWith(transformer).toArray();

        res.json(response);
    } catch (err) {
        next(err);
    }
};

/**
 * Delete a location.
 * DELETE /api/application/locations/:id
 */
export const remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const locationId = parseInt(req.params.id, 10);
        await deleteLocation(locationId);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};
