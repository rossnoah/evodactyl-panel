import type { NextFunction, Request, Response } from '@/types/express.js';
import { DaemonConnectionException } from '../../../errors/index.js';
import { prisma } from '../../../prisma/client.js';
import { DaemonConfigurationRepository } from '../../../repositories/wings/daemonConfigurationRepository.js';

/**
 * Returns system information from the Wings daemon for a given node.
 * GET /api/application/nodes/:id/system-information
 *
 * Mirrors app/Http/Controllers/Admin/Nodes/SystemInformationController.php
 */
export const getSystemInformation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const nodeId = parseInt(req.params.id as string, 10);
        const node = await prisma.nodes.findUnique({ where: { id: nodeId } });

        if (!node) {
            res.status(404).json({ error: 'Node not found.' });
            return;
        }

        const repository = new DaemonConfigurationRepository();
        repository.setNode(node);

        const data = await repository.getSystemInformation();

        res.json({
            version: data.version ?? '',
            system: {
                type: capitalize(data.os ?? 'Unknown'),
                arch: data.architecture ?? '--',
                release: data.kernel_version ?? '--',
                cpus: data.cpu_count ?? 0,
            },
        });
    } catch (err) {
        if (err instanceof DaemonConnectionException) {
            res.status(502).json({ error: 'Unable to connect to the daemon.' });
            return;
        }
        next(err);
    }
};

function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
