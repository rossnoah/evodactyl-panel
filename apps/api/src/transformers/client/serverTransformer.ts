import { BaseClientTransformer } from './baseClientTransformer.js';
import { StartupCommandService } from '../../services/servers/startupCommandService.js';
import { serializeCollection, serializeNull, serializeItem, type SerializedResource } from '../../serializers/jsonApi.js';
import * as Permissions from '../../permissions.js';
import { serverIdentifier } from '../../lib/identifier.js';

/**
 * Transformer for server models in the Client API.
 * Mirrors app/Transformers/Api/Client/ServerTransformer.php
 */
export class ClientServerTransformer extends BaseClientTransformer {
  private startupService = new StartupCommandService();

  getResourceName(): string {
    return 'server';
  }

  getDefaultIncludes(): string[] {
    return ['allocations', 'variables'];
  }

  getAvailableIncludes(): string[] {
    return ['egg', 'subusers'];
  }

  async transform(server: any): Promise<Record<string, unknown>> {
    const user = this.getUser();
    const canReadStartup = this.authorize(Permissions.ACTION_STARTUP_READ, server);
    const invocation = this.startupService.handle(server, !canReadStartup);

    const node = server.nodes || {};
    const egg = server.eggs || {};

    return {
      server_owner: user?.id === server.owner_id,
      identifier: server.uuidShort,
      __deprecated_uuid_short: server.uuidShort,
      server_identifier: serverIdentifier(server.uuid),
      internal_id: server.id,
      uuid: server.uuid,
      name: server.name,
      node: node.name ?? '',
      is_node_under_maintenance: Boolean(node.maintenance_mode),
      sftp_details: {
        ip: node.fqdn ?? '',
        port: node.daemon_sftp ?? 2022,
      },
      description: server.description,
      limits: {
        memory: server.memory,
        swap: server.swap,
        disk: server.disk,
        io: server.io,
        cpu: server.cpu,
        threads: server.threads,
        oom_disabled: Boolean(server.oom_disabled),
      },
      invocation,
      docker_image: server.image,
      egg_features: egg.features || null,
      feature_limits: {
        databases: server.database_limit,
        allocations: server.allocation_limit,
        backups: server.backup_limit,
      },
      status: server.status,
      is_suspended: server.status === 'suspended',
      is_installing: server.status === 'installing' || server.status === 'install_failed' || server.status === 'reinstall_failed',
      is_transferring: Boolean(server.transfer),
    };
  }

  async includeAllocations(server: any): Promise<SerializedResource> {
    const user = this.getUser();
    const canRead = this.authorize(Permissions.ACTION_ALLOCATION_READ, server);

    const allocations = server.allocations || [];

    if (!canRead) {
      // Only return the primary allocation without notes
      const primary = allocations.find((a: any) => a.id === server.allocation_id);
      if (!primary) return serializeCollection('allocation', []);

      return serializeCollection('allocation', [{
        id: primary.id,
        ip: primary.ip,
        ip_alias: primary.ip_alias,
        port: primary.port,
        notes: null,
        is_default: true,
      }]);
    }

    return serializeCollection('allocation', allocations.map((a: any) => ({
      id: a.id,
      ip: a.ip,
      ip_alias: a.ip_alias,
      port: a.port,
      notes: a.notes,
      is_default: a.id === server.allocation_id,
    })));
  }

  async includeVariables(server: any): Promise<SerializedResource> {
    if (!this.authorize(Permissions.ACTION_STARTUP_READ, server)) {
      return serializeNull();
    }

    const variables = (server.variables || []).filter((v: any) => Boolean(v.user_viewable));

    return serializeCollection('egg_variable', variables.map((v: any) => ({
      name: v.name,
      description: v.description,
      env_variable: v.env_variable,
      default_value: v.default_value,
      server_value: v.server_value,
      is_editable: Boolean(v.user_editable),
      rules: v.rules,
    })));
  }

  async includeEgg(server: any): Promise<SerializedResource> {
    const egg = server.eggs;
    if (!egg) return serializeNull();

    return serializeItem('egg', {
      uuid: egg.uuid,
      name: egg.name,
    });
  }

  async includeSubusers(server: any): Promise<SerializedResource> {
    if (!this.authorize(Permissions.ACTION_USER_READ, server)) {
      return serializeNull();
    }

    const subusers = server.subusers || [];

    return serializeCollection('subuser', subusers.map((s: any) => ({
      id: s.id,
      user_id: s.user_id,
      server_id: s.server_id,
      permissions: s.permissions,
      created_at: this.formatTimestamp(s.created_at),
      updated_at: this.formatTimestamp(s.updated_at),
    })));
  }
}
