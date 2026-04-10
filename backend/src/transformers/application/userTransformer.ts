import { BaseTransformer } from './baseTransformer.js';
import { ServerTransformer } from './serverTransformer.js';
import { prisma } from '../../prisma/client.js';
import { serializeCollection, serializeNull, type SerializedResource } from '../../serializers/jsonApi.js';

/**
 * Transformer for the Application API User resource.
 * Mirrors app/Transformers/Api/Application/UserTransformer.php
 */
export class UserTransformer extends BaseTransformer {
  getResourceName(): string {
    return 'user';
  }

  getAvailableIncludes(): string[] {
    return ['servers'];
  }

  transform(user: any): Record<string, unknown> {
    return {
      id: user.id,
      external_id: user.external_id,
      uuid: user.uuid,
      username: user.username,
      email: user.email,
      first_name: user.name_first,
      last_name: user.name_last,
      language: user.language,
      root_admin: Boolean(user.root_admin),
      '2fa': Boolean(user.use_totp),
      created_at: this.formatTimestamp(user.created_at),
      updated_at: this.formatTimestamp(user.updated_at),
    };
  }

  /**
   * Include the servers associated with this user.
   */
  async includeServers(user: any): Promise<SerializedResource> {
    if (!this.authorize('servers')) {
      return serializeNull();
    }

    const servers = user.servers ?? await prisma.servers.findMany({
      where: { owner_id: user.id },
    });

    const serverTransformer = this.makeTransformer(ServerTransformer);
    const transformedServers = [];
    for (const server of servers) {
      const transformed = await serverTransformer.transform(server);
      transformedServers.push(transformed);
    }

    return serializeCollection('server', transformedServers);
  }
}
