import { prisma } from '../../prisma/client.js';
import { DaemonServerRepository } from '../../repositories/wings/daemonServerRepository.js';

/**
 * Service for reinstalling a server on the daemon.
 * Mirrors app/Services/Servers/ReinstallServerService.php
 */
export class ReinstallServerService {
  private daemonServerRepository = new DaemonServerRepository();

  /**
   * Reinstall a server on the remote daemon.
   */
  async handle(server: any): Promise<any> {
    const updated = await prisma.servers.update({
      where: { id: server.id },
      data: { status: 'installing' },
    });

    const node = server.nodes ?? await prisma.nodes.findUnique({ where: { id: server.node_id } });
    await this.daemonServerRepository.setServer({ ...server, node }).reinstall();

    return updated;
  }
}
