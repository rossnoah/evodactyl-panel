import { randomUUID } from 'node:crypto';
import { prisma } from '../../prisma/client.js';
import { VariableValidatorService } from './variableValidatorService.js';
import { ServerDeletionService } from './serverDeletionService.js';
import { DaemonServerRepository } from '../../repositories/wings/daemonServerRepository.js';
import { FindViableNodesService } from '../deployment/findViableNodesService.js';
import { AllocationSelectionService } from '../deployment/allocationSelectionService.js';
import { DaemonConnectionException } from '../../errors/index.js';

const USER_LEVEL_ADMIN = 'admin';

interface DeploymentObject {
  locations: number[];
  dedicated: boolean;
  ports: string[];
}

/**
 * Service for creating new servers.
 * Mirrors app/Services/Servers/ServerCreationService.php
 *
 * This is the most complex service in the server management stack. It handles:
 * - Automatic deployment (node/allocation selection)
 * - Server model creation
 * - Allocation assignment
 * - Egg variable storage
 * - Daemon server creation
 * - Rollback on failure
 */
export class ServerCreationService {
  private validatorService = new VariableValidatorService();
  private deletionService = new ServerDeletionService();
  private daemonServerRepository = new DaemonServerRepository();
  private findViableNodesService = new FindViableNodesService();
  private allocationSelectionService = new AllocationSelectionService();

  /**
   * Create a server on the Panel and trigger a request to the daemon.
   */
  async handle(data: Record<string, any>, deployment?: DeploymentObject): Promise<any> {
    // If a deployment object is passed, find the allocation and node
    if (deployment) {
      const allocation = await this.configureDeployment(data, deployment);
      data.allocation_id = allocation.id;
      data.node_id = allocation.node_id;
    }

    // Auto-configure the node based on the selected allocation if no node was defined
    if (!data.node_id) {
      if (!data.allocation_id) {
        throw new Error('Expected a non-empty allocation_id in server creation data.');
      }
      const allocation = await prisma.allocations.findUniqueOrThrow({
        where: { id: data.allocation_id },
      });
      data.node_id = allocation.node_id;
    }

    // Auto-configure the nest based on the egg if no nest was defined
    if (!data.nest_id) {
      if (!data.egg_id) {
        throw new Error('Expected a non-empty egg_id in server creation data.');
      }
      const egg = await prisma.eggs.findUniqueOrThrow({
        where: { id: data.egg_id },
      });
      data.nest_id = egg.nest_id;
    }

    // Validate egg variables
    const eggVariableData = await this.validatorService
      .setUserLevel(USER_LEVEL_ADMIN)
      .handle(data.egg_id, data.environment ?? {});

    // Create the server in a transaction
    const server = await prisma.$transaction(async (tx) => {
      const srv = await this.createModel(tx, data);
      await this.storeAssignedAllocations(tx, srv, data);
      await this.storeEggVariables(tx, srv, eggVariableData);
      return srv;
    });

    // Tell the daemon to create the server; rollback on failure
    try {
      const node = await prisma.nodes.findUnique({ where: { id: server.node_id } });
      await this.daemonServerRepository
        .setServer({ ...server, node })
        .create(data.start_on_completion ?? false);
    } catch (error) {
      if (error instanceof DaemonConnectionException) {
        await this.deletionService.withForce().handle(server);
      }
      throw error;
    }

    // Return fresh server with relations
    return prisma.servers.findUnique({
      where: { id: server.id },
      include: {
        allocations: true,
        egg: true,
        node: true,
      },
    });
  }

  /**
   * Get an allocation for automatic deployment.
   */
  private async configureDeployment(data: Record<string, any>, deployment: DeploymentObject): Promise<any> {
    const nodes = await this.findViableNodesService
      .setLocations(deployment.locations)
      .setDisk(data.disk)
      .setMemory(data.memory)
      .handle();

    return this.allocationSelectionService
      .setDedicated(deployment.dedicated)
      .setNodes(nodes.map((n: any) => n.id))
      .setPorts(deployment.ports)
      .handle();
  }

  /**
   * Store the server in the database.
   */
  private async createModel(tx: any, data: Record<string, any>): Promise<any> {
    const uuid = await this.generateUniqueUuidCombo();

    return tx.servers.create({
      data: {
        external_id: data.external_id ?? null,
        uuid,
        uuidShort: uuid.substring(0, 8),
        node_id: data.node_id,
        name: data.name,
        description: data.description ?? '',
        status: 'installing',
        skip_scripts: data.skip_scripts ?? false,
        owner_id: data.owner_id,
        memory: data.memory,
        swap: data.swap,
        disk: data.disk,
        io: data.io,
        cpu: data.cpu,
        threads: data.threads ?? null,
        oom_disabled: data.oom_disabled ? 1 : 0,
        allocation_id: data.allocation_id,
        nest_id: data.nest_id,
        egg_id: data.egg_id,
        startup: data.startup,
        image: data.image,
        database_limit: data.database_limit ?? 0,
        allocation_limit: data.allocation_limit ?? 0,
        backup_limit: data.backup_limit ?? 0,
      },
    });
  }

  /**
   * Configure the allocations assigned to this server.
   */
  private async storeAssignedAllocations(tx: any, server: any, data: Record<string, any>): Promise<void> {
    const records = [data.allocation_id];
    if (Array.isArray(data.allocation_additional)) {
      records.push(...data.allocation_additional);
    }

    await tx.allocations.updateMany({
      where: { id: { in: records } },
      data: { server_id: server.id },
    });
  }

  /**
   * Store egg variables for the server.
   */
  private async storeEggVariables(
    tx: any,
    server: any,
    variables: Array<{ id: number; key: string; value: any }>
  ): Promise<void> {
    if (variables.length === 0) return;

    await tx.server_variables.createMany({
      data: variables.map((v) => ({
        server_id: server.id,
        variable_id: v.id,
        variable_value: v.value ?? '',
      })),
    });
  }

  /**
   * Generate a unique UUID and UUID-Short combo.
   */
  private async generateUniqueUuidCombo(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const uuid = randomUUID();
      const uuidShort = uuid.substring(0, 8);

      const existing = await prisma.servers.findFirst({
        where: {
          OR: [{ uuid }, { uuidShort }],
        },
      });

      if (!existing) return uuid;
    }

    throw new Error('Failed to generate a unique UUID after 10 attempts.');
  }
}
