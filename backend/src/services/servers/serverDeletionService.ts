import { prisma } from '../../prisma/client.js';
import { DaemonServerRepository } from '../../repositories/wings/daemonServerRepository.js';
import { DaemonConnectionException } from '../../errors/index.js';

/**
 * Service for deleting servers from the panel and daemon.
 * Mirrors app/Services/Servers/ServerDeletionService.php
 */
export class ServerDeletionService {
  private force: boolean = false;
  private daemonServerRepository = new DaemonServerRepository();

  /**
   * Set whether the server should be forcibly deleted (ignoring daemon errors).
   */
  withForce(force: boolean = true): this {
    this.force = force;
    return this;
  }

  /**
   * Delete a server from the panel, clear allocation notes, and remove associated databases.
   */
  async handle(server: any): Promise<void> {
    // First, delete from the daemon
    try {
      const node = server.nodes ?? await prisma.nodes.findUnique({ where: { id: server.node_id } });
      await this.daemonServerRepository.setServer({ ...server, node }).deleteServer();
    } catch (error) {
      if (error instanceof DaemonConnectionException) {
        // Ignore 404 errors — server doesn't exist on Wings
        if (!this.force && (error as any).statusCode !== 404) {
          throw error;
        }
        console.warn('Warning during server deletion from daemon:', (error as Error).message);
      } else if (!this.force) {
        throw error;
      }
    }

    // Delete server databases
    const databases = await prisma.databases.findMany({
      where: { server_id: server.id },
    });

    for (const database of databases) {
      try {
        await prisma.databases.delete({ where: { id: database.id } });
      } catch (error) {
        if (!this.force) throw error;
        console.warn('Warning during database deletion:', (error as Error).message);
      }
    }

    // Clear allocation notes
    await prisma.allocations.updateMany({
      where: { server_id: server.id },
      data: { notes: null, server_id: null },
    });

    // Delete server variables
    await prisma.server_variables.deleteMany({
      where: { server_id: server.id },
    });

    // Delete the server
    await prisma.servers.delete({
      where: { id: server.id },
    });
  }
}
