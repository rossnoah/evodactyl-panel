import { prisma } from '../../prisma/client.js';
import { VariableValidatorService } from './variableValidatorService.js';

const USER_LEVEL_ADMIN = 'admin';

/**
 * Service for modifying server startup configuration.
 * Mirrors app/Services/Servers/StartupModificationService.php
 */
export class StartupModificationService {
  private userLevel: string = 'user';
  private validatorService = new VariableValidatorService();

  /**
   * Set the user level for this modification.
   */
  setUserLevel(level: string): this {
    this.userLevel = level;
    return this;
  }

  /**
   * Process startup modification for a server.
   */
  async handle(server: any, data: Record<string, any>): Promise<any> {
    // Validate and update environment variables
    if (data.environment && Object.keys(data.environment).length > 0) {
      const eggId = this.userLevel === USER_LEVEL_ADMIN
        ? (data.egg_id ?? server.egg_id)
        : server.egg_id;

      const results = await this.validatorService
        .setUserLevel(this.userLevel)
        .handle(eggId, data.environment);

      for (const result of results) {
        await prisma.server_variables.upsert({
          where: {
            server_id_variable_id: {
              server_id: server.id,
              variable_id: result.id,
            },
          },
          create: {
            server_id: server.id,
            variable_id: result.id,
            variable_value: result.value ?? '',
          },
          update: {
            variable_value: result.value ?? '',
          },
        });
      }
    }

    // Update administrative settings if admin
    if (this.userLevel === USER_LEVEL_ADMIN) {
      await this.updateAdministrativeSettings(data, server);
    }

    // Return fresh server data
    return prisma.servers.findUnique({
      where: { id: server.id },
      include: {
        allocations: true,
        eggs: true,
        nodes: true,
        server_variables: true,
      },
    });
  }

  /**
   * Update certain administrative settings for a server.
   */
  private async updateAdministrativeSettings(data: Record<string, any>, server: any): Promise<void> {
    const updateData: Record<string, any> = {};

    // Handle egg change
    if (data.egg_id && data.egg_id !== server.egg_id) {
      const egg = await prisma.eggs.findUnique({
        where: { id: Number(data.egg_id) },
      });

      if (egg) {
        updateData.egg_id = egg.id;
        updateData.nest_id = egg.nest_id;
      }
    }

    // Handle startup command change
    if (data.startup !== undefined) {
      updateData.startup = data.startup;
    }

    // Handle skip_scripts
    if (data.skip_scripts !== undefined) {
      updateData.skip_scripts = Boolean(data.skip_scripts);
    }

    // Handle docker image change
    if (data.docker_image !== undefined) {
      updateData.image = data.docker_image;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.servers.update({
        where: { id: server.id },
        data: updateData,
      });
    }
  }
}
