import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../../prisma/client.js';
import { HttpForbiddenException } from '../../../../errors/index.js';

/**
 * Returns installation information for a server.
 * GET /api/remote/servers/:uuid/install
 */
export const index = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const node = (req as any).node;
    const uuid = req.params.uuid;

    const server = await prisma.servers.findFirstOrThrow({
      where: { uuid },
      include: { eggs: true, nodes: true },
    });

    if (server.node_id !== node.id) {
      throw new HttpForbiddenException('Requesting node does not have permission to access this server.');
    }

    const egg = server.eggs;

    res.json({
      container_image: (egg as any)?.copy_script_container ?? null,
      entrypoint: (egg as any)?.copy_script_entry ?? 'bash',
      script: (egg as any)?.copy_script_install ?? null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates the installation state of a server.
 * POST /api/remote/servers/:uuid/install
 */
export const store = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const node = (req as any).node;
    const uuid = req.params.uuid;

    const server = await prisma.servers.findFirstOrThrow({
      where: { uuid },
      include: { nodes: true },
    });

    if (server.node_id !== node.id) {
      throw new HttpForbiddenException('Requesting node does not have permission to access this server.');
    }

    let status: string | null = null;

    // Determine the failure status
    if (!req.body.successful) {
      status = 'install_failed';
      if (req.body.reinstall) {
        status = 'reinstall_failed';
      }
    }

    // Keep the server suspended if it's already suspended
    if (server.status === 'suspended') {
      status = 'suspended';
    }

    await prisma.servers.update({
      where: { id: server.id },
      data: {
        status,
        installed_at: new Date(),
      },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
