import type { NextFunction, Request, Response } from '@/types/express.js';
import { prisma } from '../../../prisma/client.js';
import { ReinstallServerService } from '../../../services/servers/reinstallServerService.js';
import { SuspensionService } from '../../../services/servers/suspensionService.js';

const suspensionService = new SuspensionService();
const reinstallService = new ReinstallServerService();

/**
 * Suspend a server.
 * POST /api/application/servers/:id/suspend
 */
export const suspend = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const server = await prisma.servers.findUniqueOrThrow({
            where: { id: Number(req.params.id) },
            include: { nodes: true },
        });

        await suspensionService.toggle(server, SuspensionService.ACTION_SUSPEND);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

/**
 * Unsuspend a server.
 * POST /api/application/servers/:id/unsuspend
 */
export const unsuspend = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const server = await prisma.servers.findUniqueOrThrow({
            where: { id: Number(req.params.id) },
            include: { nodes: true },
        });

        await suspensionService.toggle(server, SuspensionService.ACTION_UNSUSPEND);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

/**
 * Reinstall a server.
 * POST /api/application/servers/:id/reinstall
 */
export const reinstall = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const server = await prisma.servers.findUniqueOrThrow({
            where: { id: Number(req.params.id) },
            include: { nodes: true },
        });

        await reinstallService.handle(server);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

/**
 * Toggle the install status of a server.
 * POST /api/application/servers/:id/toggle-install
 *
 * Mirrors app/Http/Controllers/Admin/ServersController.php::toggleInstall
 */
export const toggleInstall = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const server = await prisma.servers.findUniqueOrThrow({
            where: { id: Number(req.params.id) },
        });

        if (server.status === 'install_failed') {
            res.status(400).json({
                error: 'This server is marked as having a failed installation and cannot be toggled.',
            });
            return;
        }

        // If installed (status null), mark as installing. If installing, mark as installed.
        const newStatus = server.status === null ? 'installing' : null;

        await prisma.servers.update({
            where: { id: server.id },
            data: { status: newStatus },
        });

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};
