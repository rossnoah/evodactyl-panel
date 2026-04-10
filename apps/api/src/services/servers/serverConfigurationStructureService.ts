import { EnvironmentService } from './environmentService.js';
import { prisma } from '../../prisma/client.js';

/**
 * Service for building the server configuration structure sent to Wings.
 * Mirrors app/Services/Servers/ServerConfigurationStructureService.php
 *
 * DO NOT MODIFY THIS STRUCTURE. This powers the Wings daemon configuration
 * format. Modifying it will break egg compatibility.
 */
export class ServerConfigurationStructureService {
  private environmentService = new EnvironmentService();

  /**
   * Return a configuration array for a specific server.
   */
  async handle(server: any, override: Record<string, any> = {}): Promise<Record<string, unknown>> {
    let target = server;

    // Apply overrides to a cloned server object
    if (Object.keys(override).length > 0) {
      target = { ...server, ...override };
    }

    return this.returnCurrentFormat(target);
  }

  /**
   * Returns the current format used by the Wings daemon.
   */
  private async returnCurrentFormat(server: any): Promise<Record<string, unknown>> {
    const environment = await this.environmentService.handle(server);

    // Load allocation
    const allocation = server.allocation ??
      (server.allocations || []).find((a: any) => a.id === server.allocation_id) ??
      await prisma.allocations.findUnique({ where: { id: server.allocation_id } });

    // Load all allocations for mappings
    const allocations = server.allocations ?? await prisma.allocations.findMany({
      where: { server_id: server.id },
    });

    // Build allocation mappings (ip -> ports[])
    const mappings: Record<string, number[]> = {};
    for (const alloc of allocations) {
      if (!mappings[alloc.ip]) {
        mappings[alloc.ip] = [];
      }
      mappings[alloc.ip].push(alloc.port);
    }

    // Load egg
    const egg = server.eggs ?? await prisma.eggs.findUnique({
      where: { id: server.egg_id },
    });

    // Load mounts
    const mounts = server.mounts ?? [];

    return {
      uuid: server.uuid,
      meta: {
        name: server.name,
        description: server.description,
      },
      suspended: server.status === 'suspended',
      environment,
      invocation: server.startup,
      skip_egg_scripts: server.skip_scripts,
      build: {
        memory_limit: server.memory,
        swap: server.swap,
        io_weight: server.io,
        cpu_limit: server.cpu,
        threads: server.threads,
        disk_space: server.disk,
        oom_disabled: server.oom_disabled,
      },
      container: {
        image: server.image,
        oom_disabled: server.oom_disabled,
        requires_rebuild: false,
      },
      allocations: {
        force_outgoing_ip: egg?.force_outgoing_ip ?? false,
        default: {
          ip: allocation?.ip ?? '0.0.0.0',
          port: allocation?.port ?? 0,
        },
        mappings,
      },
      mounts: mounts.map((mount: any) => ({
        source: mount.source,
        target: mount.target,
        read_only: mount.read_only,
      })),
      egg: {
        id: egg?.uuid ?? '',
        file_denylist: egg?.file_denylist ?? [],
      },
    };
  }
}
