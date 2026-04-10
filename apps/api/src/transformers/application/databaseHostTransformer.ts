import { BaseTransformer } from './baseTransformer.js';
import { serializeCollection, serializeNull, type SerializedResource } from '../../serializers/jsonApi.js';
import { prisma } from '../../prisma/client.js';

/**
 * Database host transformer for Application API responses.
 * Mirrors app/Transformers/Api/Application/DatabaseHostTransformer.php
 */
export class DatabaseHostTransformer extends BaseTransformer {
  getResourceName(): string {
    return 'database_host';
  }

  getAvailableIncludes(): string[] {
    return ['databases'];
  }

  transform(model: any): Record<string, unknown> {
    return {
      id: model.id,
      name: model.name,
      host: model.host,
      port: model.port,
      username: model.username,
      node: model.node_id,
      created_at: this.formatTimestamp(model.created_at),
      updated_at: this.formatTimestamp(model.updated_at),
    };
  }

  async includeDatabases(model: any): Promise<SerializedResource> {
    if (!this.authorize('server_databases')) {
      return serializeNull();
    }

    const databases = model.databases ?? await prisma.databases.findMany({
      where: { database_host_id: model.id },
    });

    const { ServerDatabaseTransformer } = await import('./serverDatabaseTransformer.js');
    const transformer = this.makeTransformer(ServerDatabaseTransformer);
    const items = databases.map((db: any) => transformer.transform(db));
    return serializeCollection('server_database', items);
  }
}
