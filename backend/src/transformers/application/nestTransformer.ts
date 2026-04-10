import { BaseTransformer } from './baseTransformer.js';
import { serializeCollection, serializeNull, type SerializedResource } from '../../serializers/jsonApi.js';
import { prisma } from '../../prisma/client.js';

/**
 * Nest transformer for Application API responses.
 * Mirrors app/Transformers/Api/Application/NestTransformer.php
 */
export class NestTransformer extends BaseTransformer {
  getResourceName(): string {
    return 'nest';
  }

  getAvailableIncludes(): string[] {
    return ['eggs', 'servers'];
  }

  transform(model: any): Record<string, unknown> {
    return {
      id: model.id,
      uuid: model.uuid,
      author: model.author,
      name: model.name,
      description: model.description,
      created_at: this.formatTimestamp(model.created_at),
      updated_at: this.formatTimestamp(model.updated_at),
    };
  }

  async includeEggs(model: any): Promise<SerializedResource> {
    if (!this.authorize('eggs')) {
      return serializeNull();
    }

    const eggs = model.eggs ?? await prisma.eggs.findMany({
      where: { nest_id: model.id },
    });

    const { EggTransformer } = await import('./eggTransformer.js');
    const transformer = this.makeTransformer(EggTransformer);
    const items = await Promise.all(eggs.map((egg: any) => transformer.transform(egg)));
    return serializeCollection('egg', items);
  }

  async includeServers(model: any): Promise<SerializedResource> {
    if (!this.authorize('servers')) {
      return serializeNull();
    }

    const servers = model.servers ?? await prisma.servers.findMany({
      where: { nest_id: model.id },
    });

    // Use a simple inline transform since ServerTransformer may not exist yet
    const items = servers.map((server: any) => ({
      id: server.id,
      uuid: server.uuid,
      name: server.name,
    }));
    return serializeCollection('server', items);
  }
}
