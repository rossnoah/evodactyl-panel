import type { NextFunction, Request, Response } from '@/types/express.js';
import { BadRequestHttpException } from '../../../../errors/index.js';
import { prisma } from '../../../../prisma/client.js';
import { fractal } from '../../../../serializers/fractal.js';
import { activityFromRequest } from '../../../../services/activity/activityLogService.js';
import { StartupCommandService } from '../../../../services/servers/startupCommandService.js';
import { EggVariableTransformer } from '../../../../transformers/client/eggVariableTransformer.js';

const startupService = new StartupCommandService();

/**
 * Returns the startup information for the server including all variables.
 * GET /api/client/servers/:server/startup
 */
export const index = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const server = (req as any).server;
        const startup = startupService.handle(server);

        const variables = (server.variables || []).filter((v: any) => v.user_viewable);

        const transformer = new EggVariableTransformer();
        transformer.setRequest(req);

        const response = await fractal(req)
            .collection(variables)
            .transformWith(transformer)
            .addMeta({
                startup_command: startup,
                docker_images: server.eggs?.docker_images ?? {},
                raw_startup_command: server.startup,
            })
            .toArray();

        res.json(response);
    } catch (error) {
        next(error);
    }
};

/**
 * Updates a single variable for a server.
 * PUT /api/client/servers/:server/startup/variable
 */
export const update = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const server = (req as any).server;
        const key = req.body.key;
        const value = req.body.value;

        // Find the variable
        const variable = (server.variables || []).find((v: any) => v.env_variable === key);

        if (!variable?.user_viewable) {
            throw new BadRequestHttpException('The environment variable you are trying to edit does not exist.');
        }

        if (!variable.user_editable) {
            throw new BadRequestHttpException('The environment variable you are trying to edit is read-only.');
        }

        const original = variable.server_value;

        // server_variables has no unique constraint on (server_id,
        // variable_id) at the DB level, so emulate upsert with a findFirst
        // + create/update.
        const existing = await prisma.server_variables.findFirst({
            where: { server_id: server.id, variable_id: variable.id },
        });
        if (existing) {
            await prisma.server_variables.update({
                where: { id: existing.id },
                data: { variable_value: value ?? '' },
            });
        } else {
            await prisma.server_variables.create({
                data: {
                    server_id: server.id,
                    variable_id: variable.id,
                    variable_value: value ?? '',
                },
            });
        }

        // Update the variable with the new server value for the response
        variable.server_value = value;

        const startup = startupService.handle(server);

        // Log activity if the value changed
        if (original !== value) {
            await activityFromRequest(req)
                .event('server:startup.edit')
                .property({
                    variable: variable.env_variable,
                    old: original,
                    new: value ?? '',
                })
                .subject(server, 'Pterodactyl\\Models\\Server')
                .log();
        }

        const transformer = new EggVariableTransformer();
        transformer.setRequest(req);

        const response = await fractal(req)
            .item(variable)
            .transformWith(transformer)
            .addMeta({
                startup_command: startup,
                raw_startup_command: server.startup,
            })
            .toArray();

        res.json(response);
    } catch (error) {
        next(error);
    }
};
