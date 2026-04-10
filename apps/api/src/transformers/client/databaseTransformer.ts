import { BaseClientTransformer } from './baseClientTransformer.js';
import { serializeItem, serializeNull, type SerializedResource } from '../../serializers/jsonApi.js';
import { decrypt } from '../../lib/encryption.js';
import { encodeHashid } from '../../lib/hashids.js';
import { prisma } from '../../prisma/client.js';

/**
 * Database transformer for Client API responses.
 * Mirrors app/Transformers/Api/Client/DatabaseTransformer.php
 */
export class DatabaseTransformer extends BaseClientTransformer {
  getResourceName(): string {
    return 'server_database';
  }

  getAvailableIncludes(): string[] {
    return ['password'];
  }

  async transform(model: any): Promise<Record<string, unknown>> {
    const host = model.database_hosts ?? await prisma.database_hosts.findUnique({
      where: { id: model.database_host_id },
    });

    return {
      id: encodeHashid(model.id),
      host: {
        address: host?.host ?? '',
        port: host?.port ?? 3306,
      },
      name: model.database,
      username: model.username,
      connections_from: model.remote,
      max_connections: model.max_connections,
    };
  }

  async includePassword(model: any): Promise<SerializedResource> {
    // Check permission - database.view_password
    const user = this.getUser();
    const server = model.servers ?? (model.server_id ? await prisma.servers.findUnique({ where: { id: model.server_id } }) : null);

    if (!this.authorize('database.view_password', server)) {
      return serializeNull();
    }

    return serializeItem('database_password', {
      password: decrypt(model.password),
    });
  }
}
