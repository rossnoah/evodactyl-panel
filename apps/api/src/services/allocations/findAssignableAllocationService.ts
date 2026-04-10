import { prisma } from '../../prisma/client.js';
import { config } from '../../config/index.js';
import { DisplayException } from '../../errors/index.js';
import { assignAllocations } from './assignmentService.js';

/**
 * Finds an existing unassigned allocation for a server, or creates a new one
 * with a random port from the configured range.
 * Mirrors app/Services/Allocations/FindAssignableAllocationService.php
 */
export async function findAssignableAllocation(server: any): Promise<any> {
  const allocationsConfig = config.pterodactyl.clientFeatures.allocations;

  if (!allocationsConfig.enabled) {
    throw new DisplayException(
      'The auto-allocation feature is not enabled for this panel.',
      400,
    );
  }

  // Load the server's primary allocation to get the IP
  const primaryAllocation = await prisma.allocations.findUnique({
    where: { id: server.allocation_id },
  });

  if (!primaryAllocation) {
    throw new DisplayException('Could not locate the primary allocation for this server.', 500);
  }

  // Try to find an existing unassigned allocation on the same IP
  const existingAllocation = await prisma.allocations.findFirst({
    where: {
      node_id: server.node_id,
      ip: primaryAllocation.ip,
      server_id: null,
    },
  });

  if (existingAllocation) {
    const updated = await prisma.allocations.update({
      where: { id: existingAllocation.id },
      data: { server_id: server.id },
    });
    return updated;
  }

  // No existing allocation found; create a new one from the configured range
  return createNewAllocation(server, primaryAllocation.ip);
}

async function createNewAllocation(server: any, ip: string): Promise<any> {
  const allocationsConfig = config.pterodactyl.clientFeatures.allocations;
  const start = allocationsConfig.rangeStart;
  const end = allocationsConfig.rangeEnd;

  if (!start || !end) {
    throw new DisplayException(
      'There is no available allocation space on the current node for this server.',
      400,
    );
  }

  // Get all ports already allocated on this IP within the range
  const existingAllocations = await prisma.allocations.findMany({
    where: {
      node_id: server.node_id,
      ip,
      port: { gte: start, lte: end },
    },
    select: { port: true },
  });

  const usedPorts = new Set(existingAllocations.map((a) => a.port));

  // Find available ports
  const available: number[] = [];
  for (let p = start; p <= end; p++) {
    if (!usedPorts.has(p)) {
      available.push(p);
    }
  }

  if (available.length === 0) {
    throw new DisplayException(
      'There is no available allocation space on the current node for this server.',
      400,
    );
  }

  // Pick a random available port
  const port = available[Math.floor(Math.random() * available.length)];

  // Create the allocation via the assignment service
  await assignAllocations(server.node_id, {
    allocation_ip: ip,
    allocation_ports: [String(port)],
  });

  // Fetch the newly created allocation and assign it
  const allocation = await prisma.allocations.findFirst({
    where: {
      node_id: server.node_id,
      ip,
      port,
    },
  });

  if (!allocation) {
    throw new DisplayException('Failed to create a new allocation.', 500);
  }

  const updated = await prisma.allocations.update({
    where: { id: allocation.id },
    data: { server_id: server.id },
  });

  return updated;
}
