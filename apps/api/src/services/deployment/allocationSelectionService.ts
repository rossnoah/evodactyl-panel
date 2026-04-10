import { prisma } from '../../prisma/client.js';
import { DisplayException } from '../../errors/index.js';

/**
 * Service for selecting a random viable allocation for server deployment.
 * Mirrors app/Services/Deployment/AllocationSelectionService.php
 */
export class AllocationSelectionService {
  private dedicated: boolean = false;
  private nodes: number[] = [];
  private ports: Array<number | [number, number]> = [];

  /**
   * Toggle whether the allocation must be on a dedicated IP.
   */
  setDedicated(dedicated: boolean): this {
    this.dedicated = dedicated;
    return this;
  }

  /**
   * Set the node IDs to filter allocations from.
   */
  setNodes(nodes: number[]): this {
    this.nodes = nodes;
    return this;
  }

  /**
   * Set the port filters. Can be individual ports or [start, end] ranges.
   */
  setPorts(ports: string[]): this {
    const stored: Array<number | [number, number]> = [];

    for (const port of ports) {
      const num = Number(port);
      if (!isNaN(num) && Number.isInteger(num)) {
        stored.push(num);
        continue;
      }

      const rangeMatch = port.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        if (Math.abs(end - start) > 1000) {
          throw new DisplayException('Port range exceeds the maximum allowed range of 1000.');
        }
        stored.push([start, end]);
      }
    }

    this.ports = stored;

    return this;
  }

  /**
   * Return a single allocation that should be used as the default allocation.
   */
  async handle(): Promise<any> {
    const whereClause: any = {
      server_id: null,
    };

    if (this.nodes.length > 0) {
      whereClause.node_id = { in: this.nodes };
    }

    // Build port filter
    if (this.ports.length > 0) {
      const portConditions: any[] = [];
      for (const port of this.ports) {
        if (Array.isArray(port)) {
          portConditions.push({
            port: { gte: port[0], lte: port[1] },
          });
        } else {
          portConditions.push({ port });
        }
      }
      whereClause.OR = portConditions;
    }

    // If dedicated, exclude IPs that already have server allocations
    if (this.dedicated) {
      const usedIps = await prisma.allocations.findMany({
        where: {
          server_id: { not: null },
          ...(this.nodes.length > 0 ? { node_id: { in: this.nodes } } : {}),
        },
        select: { ip: true },
        distinct: ['ip'],
      });

      const excludedIps = usedIps.map((a: any) => a.ip);
      if (excludedIps.length > 0) {
        whereClause.ip = { notIn: excludedIps };
      }
    }

    // Get all matching allocations and select one randomly
    const allocations = await prisma.allocations.findMany({
      where: whereClause,
    });

    if (allocations.length === 0) {
      throw new DisplayException('No viable allocations could be found matching the specified criteria.');
    }

    // Select a random allocation
    const randomIndex = Math.floor(Math.random() * allocations.length);
    return allocations[randomIndex];
  }
}
