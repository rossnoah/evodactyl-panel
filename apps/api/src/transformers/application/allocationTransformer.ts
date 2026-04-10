import { BaseTransformer } from './baseTransformer.js';
import { prisma } from '../../prisma/client.js';
import { serializeItem, serializeNull, type SerializedResource } from '../../serializers/jsonApi.js';

/**
 * Transforms an Allocation model for the Application API.
 * Mirrors app/Transformers/Api/Application/AllocationTransformer.php
 */
export class AllocationTransformer extends BaseTransformer {
  getResourceName(): string {
    return 'allocation';
  }

  getAvailableIncludes(): string[] {
    return ['node', 'server'];
  }

  transform(allocation: any): Record<string, unknown> {
    return {
      id: allocation.id,
      ip: allocation.ip,
      alias: allocation.ip_alias,
      port: allocation.port,
      notes: allocation.notes,
      assigned: allocation.server_id !== null && allocation.server_id !== undefined,
    };
  }

  async includeNode(allocation: any): Promise<SerializedResource> {
    if (!this.authorize('nodes')) {
      return serializeNull();
    }

    const node = allocation.nodes ?? await prisma.nodes.findUnique({
      where: { id: allocation.node_id },
    });

    if (!node) return serializeNull();

    const { NodeTransformer } = await import('./nodeTransformer.js');
    const transformer = this.makeTransformer(NodeTransformer);
    return serializeItem(transformer.getResourceName(), await transformer.transform(node));
  }

  async includeServer(allocation: any): Promise<SerializedResource> {
    if (!this.authorize('servers') || !allocation.server_id) {
      return serializeNull();
    }

    const server = allocation.server ?? await prisma.servers.findUnique({
      where: { id: allocation.server_id },
    });

    if (!server) return serializeNull();

    return serializeItem('server', { id: server.id, uuid: server.uuid, name: server.name });
  }
}
