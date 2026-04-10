import { prisma } from '../../prisma/client.js';
import { ConflictHttpException } from '../../errors/index.js';
import { DaemonServerRepository } from '../../repositories/wings/daemonServerRepository.js';

const ACTION_SUSPEND = 'suspend';
const ACTION_UNSUSPEND = 'unsuspend';

/**
 * Service for toggling server suspension state.
 * Mirrors app/Services/Servers/SuspensionService.php
 */
export class SuspensionService {
  static readonly ACTION_SUSPEND = ACTION_SUSPEND;
  static readonly ACTION_UNSUSPEND = ACTION_UNSUSPEND;

  private daemonServerRepository = new DaemonServerRepository();

  /**
   * Suspend or unsuspend a server.
   */
  async toggle(server: any, action: string = ACTION_SUSPEND): Promise<void> {
    if (action !== ACTION_SUSPEND && action !== ACTION_UNSUSPEND) {
      throw new Error(`Invalid suspension action: ${action}`);
    }

    const isSuspending = action === ACTION_SUSPEND;
    const isSuspended = server.status === 'suspended';

    // Nothing needs to happen if the state is already what we want
    if (isSuspending === isSuspended) {
      return;
    }

    // Check if the server is currently being transferred
    if (server.transfer) {
      throw new ConflictHttpException('Cannot toggle suspension status on a server that is currently being transferred.');
    }

    // Update the server's suspension status
    await prisma.servers.update({
      where: { id: server.id },
      data: { status: isSuspending ? 'suspended' : null },
    });

    try {
      // Tell Wings to re-sync the server state
      const node = server.nodes ?? await prisma.nodes.findUnique({ where: { id: server.node_id } });
      await this.daemonServerRepository.setServer({ ...server, node }).sync();
    } catch (error) {
      // Rollback the server's suspension status if Wings fails to sync
      await prisma.servers.update({
        where: { id: server.id },
        data: { status: isSuspending ? null : 'suspended' },
      });
      throw error;
    }
  }
}
