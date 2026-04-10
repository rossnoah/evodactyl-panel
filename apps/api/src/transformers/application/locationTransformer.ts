import { BaseTransformer } from './baseTransformer.js';
import { prisma } from '../../prisma/client.js';
import { serializeItem, serializeNull, type SerializedResource } from '../../serializers/jsonApi.js';

/**
 * Transforms a Location model for the Application API.
 * Mirrors app/Transformers/Api/Application/LocationTransformer.php
 */
export class LocationTransformer extends BaseTransformer {
  getResourceName(): string {
    return 'location';
  }

  getAvailableIncludes(): string[] {
    return ['nodes', 'servers'];
  }

  transform(location: any): Record<string, unknown> {
    return {
      id: location.id,
      short: location.short,
      long: location.long,
      updated_at: this.formatTimestamp(location.updated_at),
      created_at: this.formatTimestamp(location.created_at),
    };
  }

  async includeNodes(location: any): Promise<SerializedResource> {
    if (!this.authorize('nodes')) {
      return serializeNull();
    }

    const nodes = location.nodes ?? await prisma.nodes.findMany({
      where: { location_id: location.id },
    });

    const { NodeTransformer } = await import('./nodeTransformer.js');
    const transformer = this.makeTransformer(NodeTransformer);
    const items = [];
    for (const node of nodes) {
      items.push(serializeItem(transformer.getResourceName(), await transformer.transform(node)));
    }

    return {
      object: 'list',
      data: items,
    };
  }

  async includeServers(location: any): Promise<SerializedResource> {
    if (!this.authorize('servers')) {
      return serializeNull();
    }

    const servers = location.servers ?? await prisma.servers.findMany({
      where: {
        node: {
          location_id: location.id,
        },
      },
    });

    const items = servers.map((s: any) => serializeItem('server', { id: s.id, uuid: s.uuid, name: s.name }));

    return {
      object: 'list',
      data: items,
    };
  }
}
