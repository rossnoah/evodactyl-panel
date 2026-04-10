import { BaseTransformer } from './baseTransformer.js';
import { serializeItem, serializeNull, type SerializedResource } from '../../serializers/jsonApi.js';
import { decrypt } from '../../lib/encryption.js';
import { prisma } from '../../prisma/client.js';

/**
 * Server database transformer for Application API responses.
 * Mirrors app/Transformers/Api/Application/ServerDatabaseTransformer.php
 */
export class ServerDatabaseTransformer extends BaseTransformer {
  getResourceName(): string {
    return 'server_database';
  }

  getAvailableIncludes(): string[] {
    return ['password', 'host'];
  }

  transform(model: any): Record<string, unknown> {
    return {
      id: model.id,
      server: model.server_id,
      host: model.database_host_id,
      database: model.database,
      username: model.username,
      remote: model.remote,
      max_connections: model.max_connections,
      created_at: this.formatTimestamp(model.created_at),
      updated_at: this.formatTimestamp(model.updated_at),
    };
  }

  async includePassword(model: any): Promise<SerializedResource> {
    return serializeItem('database_password', {
      password: decrypt(model.password),
    });
  }

  async includeHost(model: any): Promise<SerializedResource> {
    if (!this.authorize('database_hosts')) {
      return serializeNull();
    }

    const host = model.database_hosts ?? await prisma.database_hosts.findUnique({
      where: { id: model.database_host_id },
    });

    if (!host) return serializeNull();

    const { DatabaseHostTransformer } = await import('./databaseHostTransformer.js');
    const transformer = this.makeTransformer(DatabaseHostTransformer);
    const transformed = transformer.transform(host);
    return serializeItem('database_host', transformed);
  }
}
