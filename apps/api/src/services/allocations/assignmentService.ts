import { prisma } from '../../prisma/client.js';
import { DisplayException } from '../../errors/index.js';

const CIDR_MAX_BITS = 25;
const CIDR_MIN_BITS = 32;
const PORT_FLOOR = 1024;
const PORT_CEIL = 65535;
const PORT_RANGE_LIMIT = 1000;
const PORT_RANGE_REGEX = /^(\d{4,5})-(\d{4,5})$/;

/**
 * Insert allocations into the database for a specific node.
 * Handles IP addresses (including CIDR notation) and port ranges.
 * Mirrors app/Services/Allocations/AssignmentService.php
 */
export async function assignAllocations(
  nodeId: number,
  data: {
    allocation_ip: string;
    allocation_ports: (string | number)[];
    allocation_alias?: string | null;
  },
): Promise<void> {
  const ipInput = data.allocation_ip;

  // Check for CIDR notation
  const cidrParts = ipInput.split('/');
  if (cidrParts.length > 2) {
    throw new DisplayException('Invalid IP address or CIDR notation.', 400);
  }

  if (cidrParts.length === 2) {
    const bits = parseInt(cidrParts[1], 10);
    if (isNaN(bits) || bits < CIDR_MAX_BITS || bits > CIDR_MIN_BITS) {
      throw new DisplayException(
        `CIDR notation must be between /${CIDR_MAX_BITS} and /${CIDR_MIN_BITS}.`,
        400,
      );
    }
  }

  // For simplicity, resolve the IP. CIDR expansion for IPv4 subnets is handled here.
  const ips = expandCidr(cidrParts[0], cidrParts.length === 2 ? parseInt(cidrParts[1], 10) : 32);

  const insertRows: Array<{
    node_id: number;
    ip: string;
    port: number;
    ip_alias: string | null;
    server_id: number | null;
  }> = [];

  for (const ip of ips) {
    for (const portEntry of data.allocation_ports) {
      const port = String(portEntry);
      const rangeMatch = PORT_RANGE_REGEX.exec(port);

      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);

        if (start <= PORT_FLOOR || end > PORT_CEIL) {
          throw new DisplayException(
            `Port numbers must be between ${PORT_FLOOR + 1} and ${PORT_CEIL}.`,
            400,
          );
        }

        const count = end - start + 1;
        if (count > PORT_RANGE_LIMIT) {
          throw new DisplayException(
            `Port range cannot exceed ${PORT_RANGE_LIMIT} ports.`,
            400,
          );
        }

        for (let p = start; p <= end; p++) {
          insertRows.push({
            node_id: nodeId,
            ip,
            port: p,
            ip_alias: data.allocation_alias ?? null,
            server_id: null,
          });
        }
      } else if (/^\d+$/.test(port)) {
        const portNum = parseInt(port, 10);
        if (portNum <= PORT_FLOOR || portNum > PORT_CEIL) {
          throw new DisplayException(
            `Port numbers must be between ${PORT_FLOOR + 1} and ${PORT_CEIL}.`,
            400,
          );
        }

        insertRows.push({
          node_id: nodeId,
          ip,
          port: portNum,
          ip_alias: data.allocation_alias ?? null,
          server_id: null,
        });
      } else {
        throw new DisplayException(
          `Invalid port mapping: ${port}. Ports must be numeric or a range (e.g. 25565-25570).`,
          400,
        );
      }
    }
  }

  // Insert allocations, skipping duplicates (matching PHP's insertIgnore behavior)
  // Prisma doesn't have insertIgnore, so we use skipDuplicates with createMany
  if (insertRows.length > 0) {
    await prisma.allocations.createMany({
      data: insertRows,
      skipDuplicates: true,
    });
  }
}

/**
 * Expand a CIDR notation into individual IP addresses.
 * For /32 (single host), returns just the IP.
 */
function expandCidr(ip: string, bits: number): string[] {
  if (bits === 32) {
    return [ip];
  }

  const parts = ip.split('.').map(Number);
  const ipNum = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;

  const mask = (~0 << (32 - bits)) >>> 0;
  const network = (ipNum & mask) >>> 0;
  const broadcast = (network | ~mask) >>> 0;

  const ips: string[] = [];
  // Skip network and broadcast addresses
  for (let i = network + 1; i < broadcast; i++) {
    ips.push(
      `${(i >>> 24) & 0xff}.${(i >>> 16) & 0xff}.${(i >>> 8) & 0xff}.${i & 0xff}`,
    );
  }

  return ips;
}
