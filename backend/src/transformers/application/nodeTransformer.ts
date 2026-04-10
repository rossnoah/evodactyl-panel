import { BaseTransformer } from './baseTransformer.js';
import { prisma } from '../../prisma/client.js';
import { serializeCollection, serializeItem, serializeNull, type SerializedResource } from '../../serializers/jsonApi.js';

/**
 * Transforms a Node model for the Application API.
 * Mirrors app/Transformers/Api/Application/NodeTransformer.php
 */
export class NodeTransformer extends BaseTransformer {
  getResourceName(): string {
    return 'node';
  }

  getAvailableIncludes(): string[] {
    return ['allocations', 'location', 'servers'];
  }

  async transform(node: any): Promise<Record<string, unknown>> {
    // Aggregate allocated resources from servers on this node
    const resources = await prisma.servers.aggregate({
      where: { node_id: node.id },
      _sum: { memory: true, disk: true },
    });

    return {
      id: node.id,
      uuid: node.uuid,
      public: Boolean(node.public),
      name: node.name,
      description: node.description,
      location_id: node.location_id,
      fqdn: node.fqdn,
      scheme: node.scheme,
      behind_proxy: node.behind_proxy,
      maintenance_mode: node.maintenance_mode,
      memory: node.memory,
      memory_overallocate: node.memory_overallocate,
      disk: node.disk,
      disk_overallocate: node.disk_overallocate,
      upload_size: node.upload_size,
      daemon_listen: node.daemonListen,
      daemon_sftp: node.daemonSFTP,
      daemon_base: node.daemonBase,
      created_at: this.formatTimestamp(node.created_at),
      updated_at: this.formatTimestamp(node.updated_at),
      allocated_resources: {
        memory: resources._sum.memory ?? 0,
        disk: resources._sum.disk ?? 0,
      },
    };
  }

  async includeAllocations(node: any): Promise<SerializedResource> {
    if (!this.authorize('allocations')) {
      return serializeNull();
    }

    const allocations = node.allocations ?? await prisma.allocations.findMany({
      where: { node_id: node.id },
    });

    const { AllocationTransformer } = await import('./allocationTransformer.js');
    const transformer = this.makeTransformer(AllocationTransformer);
    const items = [];
    for (const allocation of allocations) {
      items.push(serializeItem(transformer.getResourceName(), await transformer.transform(allocation)));
    }

    return {
      object: 'list',
      data: items,
    };
  }

  async includeLocation(node: any): Promise<SerializedResource> {
    if (!this.authorize('locations')) {
      return serializeNull();
    }

    const location = node.locations ?? await prisma.locations.findUnique({
      where: { id: node.location_id },
    });

    if (!location) return serializeNull();

    const { LocationTransformer } = await import('./locationTransformer.js');
    const transformer = this.makeTransformer(LocationTransformer);
    return serializeItem(transformer.getResourceName(), await transformer.transform(location));
  }

  async includeServers(node: any): Promise<SerializedResource> {
    if (!this.authorize('servers')) {
      return serializeNull();
    }

    const servers = node.servers ?? await prisma.servers.findMany({
      where: { node_id: node.id },
      include: { users: true, nests: true, eggs: true },
    });

    const items = servers.map((s: any) => serializeItem('server', {
      id: s.id,
      uuid: s.uuid,
      identifier: s.uuidShort,
      name: s.name,
      owner_id: s.owner_id,
      owner: s.users ? { id: s.users.id, username: s.users.username } : undefined,
      nest: s.nests ? { id: s.nests.id, name: s.nests.name } : undefined,
      egg: s.eggs ? { id: s.eggs.id, name: s.eggs.name } : undefined,
    }));

    return {
      object: 'list',
      data: items,
    };
  }
}
