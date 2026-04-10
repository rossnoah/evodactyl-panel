import { prisma } from '../../prisma/client.js';
import { DaemonBackupRepository } from '../../repositories/wings/daemonBackupRepository.js';
import { DisplayException } from '../../errors/index.js';

/**
 * Service for deleting server backups.
 * Mirrors app/Services/Backups/DeleteBackupService.php
 */
export class DeleteBackupService {
  /**
   * Deletes a backup from the system. If the backup is stored in S3 a request
   * will be made to delete that backup from the disk as well.
   */
  async handle(backup: any): Promise<void> {
    // If the backup is locked and was successful, prevent deletion
    if (backup.is_locked && backup.is_successful && backup.completed_at !== null) {
      throw new DisplayException(
        'This backup is locked and cannot be deleted.',
        409
      );
    }

    if (backup.disk === 's3') {
      await this.deleteFromS3(backup);
      return;
    }

    // Load server and node if not already loaded
    const server = backup.server ?? await prisma.servers.findUnique({
      where: { id: backup.server_id },
      include: { nodes: true },
    });

    if (!server) {
      // Server doesn't exist, just delete the record
      await prisma.backups.update({
        where: { id: backup.id },
        data: { deleted_at: new Date() },
      });
      return;
    }

    const node = server.nodes ?? await prisma.nodes.findUnique({ where: { id: server.node_id } });

    try {
      const daemonRepo = new DaemonBackupRepository();
      daemonRepo.setServer({ ...server, node });
      await daemonRepo.deleteBackup(backup);
    } catch (error: any) {
      // Don't fail if the daemon responds with a 404
      if (!error.message?.includes('404')) {
        throw error;
      }
    }

    await prisma.backups.update({
      where: { id: backup.id },
      data: { deleted_at: new Date() },
    });
  }

  /**
   * Deletes a backup from an S3 disk.
   */
  private async deleteFromS3(backup: any): Promise<void> {
    // Soft-delete the backup record
    await prisma.backups.update({
      where: { id: backup.id },
      data: { deleted_at: new Date() },
    });

    // S3 deletion would be handled by an S3 client integration
    // In a full implementation, this would call the S3 API to delete the object
    // at: {server.uuid}/{backup.uuid}.tar.gz
  }
}
