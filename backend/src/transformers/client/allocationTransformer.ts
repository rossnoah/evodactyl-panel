import { BaseClientTransformer } from './baseClientTransformer.js';

/**
 * Transforms an Allocation model for the Client API.
 * Mirrors app/Transformers/Api/Client/AllocationTransformer.php
 */
export class ClientAllocationTransformer extends BaseClientTransformer {
  getResourceName(): string {
    return 'allocation';
  }

  transform(allocation: any): Record<string, unknown> {
    return {
      id: allocation.id,
      ip: allocation.ip,
      ip_alias: allocation.ip_alias,
      port: allocation.port,
      notes: allocation.notes,
      is_default: allocation.server?.allocation_id === allocation.id,
    };
  }
}
