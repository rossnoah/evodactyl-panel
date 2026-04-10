import { prisma } from '../../prisma/client.js';
import { DisplayException } from '../../errors/index.js';

/**
 * Service for finding nodes that can host a new server based on resource requirements.
 * Mirrors app/Services/Deployment/FindViableNodesService.php
 */
export class FindViableNodesService {
  private locations: number[] = [];
  private disk: number | null = null;
  private memory: number | null = null;

  /**
   * Set the locations to search through.
   */
  setLocations(locations: number[]): this {
    this.locations = locations;
    return this;
  }

  /**
   * Set the disk requirement.
   */
  setDisk(disk: number): this {
    this.disk = disk;
    return this;
  }

  /**
   * Set the memory requirement.
   */
  setMemory(memory: number): this {
    this.memory = memory;
    return this;
  }

  /**
   * Returns an array of nodes that meet the resource requirements.
   * Nodes must be public, in the specified locations, and have enough
   * available memory and disk space (accounting for overallocation).
   */
  async handle(): Promise<any[]> {
    if (this.disk === null) throw new Error('Disk space must be set');
    if (this.memory === null) throw new Error('Memory must be set');

    // Get all public nodes, optionally filtered by location
    const whereClause: any = { public: 1 };
    if (this.locations.length > 0) {
      whereClause.location_id = { in: this.locations };
    }

    const nodes = await prisma.nodes.findMany({
      where: whereClause,
      include: {
        servers: {
          select: {
            memory: true,
            disk: true,
          },
        },
      },
    });

    // Filter nodes that have enough capacity
    const viable = nodes.filter((node: any) => {
      const totalMemory = (node.servers || []).reduce((sum: number, s: any) => sum + (s.memory || 0), 0);
      const totalDisk = (node.servers || []).reduce((sum: number, s: any) => sum + (s.disk || 0), 0);

      const maxMemory = node.memory * (1 + (node.memory_overallocate || 0) / 100);
      const maxDisk = node.disk * (1 + (node.disk_overallocate || 0) / 100);

      return (totalMemory + this.memory!) <= maxMemory && (totalDisk + this.disk!) <= maxDisk;
    });

    if (viable.length === 0) {
      throw new DisplayException('No viable nodes could be found matching the specified criteria.', 400);
    }

    return viable;
  }
}
