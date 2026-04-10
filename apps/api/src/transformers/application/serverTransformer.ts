import { BaseTransformer } from './baseTransformer.js';
import { EnvironmentService } from '../../services/servers/environmentService.js';
import { prisma } from '../../prisma/client.js';
import { serializeItem, serializeCollection, serializeNull, type SerializedResource } from '../../serializers/jsonApi.js';

/**
 * Transformer for server models in the Application API.
 * Mirrors app/Transformers/Api/Application/ServerTransformer.php
 */
export class ServerTransformer extends BaseTransformer {
  private environmentService = new EnvironmentService();

  getResourceName(): string {
    return 'server';
  }

  getAvailableIncludes(): string[] {
    return [
      'allocations',
      'user',
      'subusers',
      'nest',
      'egg',
      'variables',
      'location',
      'node',
      'databases',
    ];
  }

  async transform(server: any): Promise<Record<string, unknown>> {
    const environment = await this.environmentService.handle(server);

    return {
      id: server.id,
      external_id: server.external_id,
      uuid: server.uuid,
      identifier: server.uuidShort,
      name: server.name,
      description: server.description,
      status: server.status,
      suspended: server.status === 'suspended',
      limits: {
        memory: server.memory,
        swap: server.swap,
        disk: server.disk,
        io: server.io,
        cpu: server.cpu,
        threads: server.threads,
        oom_disabled: Boolean(server.oom_disabled),
      },
      feature_limits: {
        databases: server.database_limit,
        allocations: server.allocation_limit,
        backups: server.backup_limit,
      },
      user: server.owner_id,
      node: server.node_id,
      allocation: server.allocation_id,
      nest: server.nest_id,
      egg: server.egg_id,
      container: {
        startup_command: server.startup,
        image: server.image,
        installed: server.status !== 'installing' && server.status !== 'install_failed' && server.status !== 'reinstall_failed' ? 1 : 0,
        environment,
      },
      updated_at: this.formatTimestamp(server.updated_at),
      created_at: this.formatTimestamp(server.created_at),
    };
  }

  async includeAllocations(server: any): Promise<SerializedResource> {
    if (!this.authorize('allocations')) {
      return serializeNull();
    }

    const allocations = server.allocations ?? await prisma.allocations.findMany({
      where: { server_id: server.id },
    });

    return serializeCollection('allocation', allocations.map((a: any) => ({
      id: a.id,
      ip: a.ip,
      ip_alias: a.ip_alias,
      port: a.port,
      notes: a.notes,
      is_default: a.id === server.allocation_id,
    })));
  }

  async includeUser(server: any): Promise<SerializedResource> {
    if (!this.authorize('users')) {
      return serializeNull();
    }

    const user = server.users ?? await prisma.users.findUnique({
      where: { id: server.owner_id },
    });

    if (!user) return serializeNull();

    return serializeItem('user', {
      id: user.id,
      external_id: user.external_id,
      uuid: user.uuid,
      username: user.username,
      email: user.email,
      name_first: user.name_first,
      name_last: user.name_last,
      language: user.language,
      root_admin: user.root_admin,
      '2fa': user.use_totp,
      created_at: this.formatTimestamp(user.created_at),
      updated_at: this.formatTimestamp(user.updated_at),
    });
  }

  async includeSubusers(server: any): Promise<SerializedResource> {
    if (!this.authorize('users')) {
      return serializeNull();
    }

    const subusers = server.subusers ?? await prisma.subusers.findMany({
      where: { server_id: server.id },
      include: { users: true },
    });

    return serializeCollection('subuser', subusers.map((s: any) => ({
      id: s.id,
      user_id: s.user_id,
      server_id: s.server_id,
      permissions: s.permissions,
      created_at: this.formatTimestamp(s.created_at),
      updated_at: this.formatTimestamp(s.updated_at),
    })));
  }

  async includeNest(server: any): Promise<SerializedResource> {
    if (!this.authorize('nests')) {
      return serializeNull();
    }

    const nest = server.nests ?? await prisma.nests.findUnique({
      where: { id: server.nest_id },
    });

    if (!nest) return serializeNull();

    return serializeItem('nest', {
      id: nest.id,
      uuid: nest.uuid,
      author: nest.author,
      name: nest.name,
      description: nest.description,
      created_at: this.formatTimestamp(nest.created_at),
      updated_at: this.formatTimestamp(nest.updated_at),
    });
  }

  async includeEgg(server: any): Promise<SerializedResource> {
    if (!this.authorize('eggs')) {
      return serializeNull();
    }

    const egg = server.eggs ?? await prisma.eggs.findUnique({
      where: { id: server.egg_id },
    });

    if (!egg) return serializeNull();

    return serializeItem('egg', {
      id: egg.id,
      uuid: egg.uuid,
      name: egg.name,
      nest: egg.nest_id,
      author: egg.author,
      description: egg.description,
      docker_image: egg.docker_image,
      docker_images: egg.docker_images,
      created_at: this.formatTimestamp(egg.created_at),
      updated_at: this.formatTimestamp(egg.updated_at),
    });
  }

  async includeVariables(server: any): Promise<SerializedResource> {
    if (!this.authorize('servers')) {
      return serializeNull();
    }

    const variables = server.variables ?? await prisma.egg_variables.findMany({
      where: { egg_id: server.egg_id },
    });

    // Load server variable values
    const serverVars = await prisma.server_variables.findMany({
      where: { server_id: server.id },
    });

    const serverVarMap = new Map(serverVars.map((sv: any) => [sv.variable_id, sv.variable_value]));

    return serializeCollection('server_variable', variables.map((v: any) => ({
      ...v,
      server_value: serverVarMap.get(v.id) ?? v.default_value,
    })));
  }

  async includeLocation(server: any): Promise<SerializedResource> {
    if (!this.authorize('locations')) {
      return serializeNull();
    }

    const node = server.nodes ?? await prisma.nodes.findUnique({
      where: { id: server.node_id },
    });

    if (!node) return serializeNull();

    const location = await prisma.locations.findUnique({
      where: { id: node.location_id },
    });

    if (!location) return serializeNull();

    return serializeItem('location', {
      id: location.id,
      short: location.short,
      long: location.long,
      created_at: this.formatTimestamp(location.created_at),
      updated_at: this.formatTimestamp(location.updated_at),
    });
  }

  async includeNode(server: any): Promise<SerializedResource> {
    if (!this.authorize('nodes')) {
      return serializeNull();
    }

    const node = server.nodes ?? await prisma.nodes.findUnique({
      where: { id: server.node_id },
    });

    if (!node) return serializeNull();

    return serializeItem('node', {
      id: node.id,
      uuid: node.uuid,
      public: node.public,
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
      daemon_listen: node.daemon_listen,
      daemon_sftp: node.daemon_sftp,
      daemon_base: node.daemon_base,
      created_at: this.formatTimestamp(node.created_at),
      updated_at: this.formatTimestamp(node.updated_at),
    });
  }

  async includeDatabases(server: any): Promise<SerializedResource> {
    if (!this.authorize('server_databases')) {
      return serializeNull();
    }

    const databases = server.databases ?? await prisma.databases.findMany({
      where: { server_id: server.id },
    });

    return serializeCollection('databases', databases.map((db: any) => ({
      id: db.id,
      server: db.server_id,
      host: db.database_host_id,
      database: db.database,
      username: db.username,
      remote: db.remote,
      max_connections: db.max_connections,
      created_at: this.formatTimestamp(db.created_at),
      updated_at: this.formatTimestamp(db.updated_at),
    })));
  }
}
