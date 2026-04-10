import { prisma } from '../../prisma/client.js';
import { DisplayException } from '../../errors/index.js';
import { DaemonServerRepository } from '../../repositories/wings/daemonServerRepository.js';
import { ServerConfigurationStructureService } from './serverConfigurationStructureService.js';

/**
 * Service for modifying server build configuration (resources, allocations).
 * Mirrors app/Services/Servers/BuildModificationService.php
 */
export class BuildModificationService {
  private daemonServerRepository = new DaemonServerRepository();
  private structureService = new ServerConfigurationStructureService();

  /**
   * Change the build details for a specified server.
   */
  async handle(server: any, data: Record<string, any>): Promise<any> {
    // Process allocation changes
    await this.processAllocations(server, data);

    // Validate the default allocation if changed
    if (data.allocation_id && data.allocation_id !== server.allocation_id) {
      const alloc = await prisma.allocations.findFirst({
        where: { id: data.allocation_id, server_id: server.id },
      });
      if (!alloc) {
        throw new DisplayException('The requested default allocation is not currently assigned to this server.');
      }
    }

    // Build the update data
    const updateData: Record<string, any> = {};

    const fields = ['oom_disabled', 'memory', 'swap', 'io', 'cpu', 'threads', 'disk', 'allocation_id'];
    for (const field of fields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    updateData.database_limit = data.database_limit ?? 0;
    updateData.allocation_limit = data.allocation_limit ?? 0;
    updateData.backup_limit = data.backup_limit ?? 0;

    const updated = await prisma.servers.update({
      where: { id: server.id },
      data: updateData,
      include: {
        allocations: true,
        eggs: true,
        nodes: true,
      },
    });

    // Sync with Wings daemon (best-effort)
    try {
      const node = updated.nodes ?? server.nodes ?? await prisma.nodes.findUnique({ where: { id: server.node_id } });
      await this.daemonServerRepository.setServer({ ...updated, node }).sync();
    } catch (error) {
      // Log warning but don't fail — Wings will pick up changes on next boot
      console.warn('Failed to sync server build changes with daemon:', (error as Error).message);
    }

    return updated;
  }

  /**
   * Process allocation additions and removals.
   */
  private async processAllocations(server: any, data: Record<string, any>): Promise<void> {
    if (!data.add_allocations?.length && !data.remove_allocations?.length) {
      return;
    }

    let freshlyAllocated: number | null = null;

    // Handle addition of allocations
    if (data.add_allocations?.length) {
      const available = await prisma.allocations.findMany({
        where: {
          node_id: server.node_id,
          id: { in: data.add_allocations },
          server_id: null,
        },
      });

      if (available.length > 0) {
        freshlyAllocated = available[0].id;

        await prisma.allocations.updateMany({
          where: {
            id: { in: available.map((a: any) => a.id) },
          },
          data: { server_id: server.id, notes: null },
        });
      }
    }

    // Handle removal of allocations
    if (data.remove_allocations?.length) {
      for (const allocationId of data.remove_allocations) {
        if (allocationId === (data.allocation_id ?? server.allocation_id)) {
          if (!freshlyAllocated) {
            throw new DisplayException(
              'You are attempting to delete the default allocation for this server but there is no fallback allocation to use.'
            );
          }
          data.allocation_id = freshlyAllocated;
        }
      }

      const idsToRemove = data.add_allocations
        ? data.remove_allocations.filter((id: number) => !data.add_allocations.includes(id))
        : data.remove_allocations;

      if (idsToRemove.length > 0) {
        await prisma.allocations.updateMany({
          where: {
            node_id: server.node_id,
            server_id: server.id,
            id: { in: idsToRemove },
          },
          data: { notes: null, server_id: null },
        });
      }
    }
  }
}
