/**
 * Validation schemas for Allocation API requests.
 * Mirrors app/Http/Requests/Api/Application/Allocations/StoreAllocationRequest.php
 */

export interface StoreAllocationData {
  allocation_ip: string;
  allocation_ports: string[];
  allocation_alias?: string | null;
}

/**
 * Validate store allocation request data and normalize to internal format.
 */
export function validateStoreAllocation(body: Record<string, any>): StoreAllocationData {
  const errors: string[] = [];

  if (!body.ip || typeof body.ip !== 'string') {
    errors.push('ip is required and must be a string.');
  }

  if (!body.ports || !Array.isArray(body.ports)) {
    errors.push('ports is required and must be an array.');
  } else {
    for (const port of body.ports) {
      if (typeof port !== 'string' && typeof port !== 'number') {
        errors.push('Each port must be a string or number.');
        break;
      }
    }
  }

  if (body.alias !== undefined && body.alias !== null && typeof body.alias !== 'string') {
    errors.push('alias must be a string.');
  } else if (typeof body.alias === 'string' && body.alias.length > 191) {
    errors.push('alias must not exceed 191 characters.');
  }

  if (errors.length > 0) {
    const err = new Error(errors.join(' ')) as any;
    err.statusCode = 422;
    throw err;
  }

  return {
    allocation_ip: body.ip,
    allocation_ports: body.ports.map(String),
    allocation_alias: body.alias ?? null,
  };
}
