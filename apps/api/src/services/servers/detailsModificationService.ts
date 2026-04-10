import { prisma } from '../../prisma/client.js';

/**
 * Service for updating server details (name, description, owner, external_id).
 * Mirrors app/Services/Servers/DetailsModificationService.php
 */
export class DetailsModificationService {
  /**
   * Update the details for a single server instance.
   */
  async handle(server: any, data: {
    external_id?: string | null;
    owner_id?: number;
    name?: string;
    description?: string;
  }): Promise<any> {
    const updated = await prisma.servers.update({
      where: { id: server.id },
      data: {
        external_id: data.external_id ?? undefined,
        owner_id: data.owner_id ?? undefined,
        name: data.name ?? undefined,
        description: data.description ?? server.description,
      },
    });

    return updated;
  }
}
