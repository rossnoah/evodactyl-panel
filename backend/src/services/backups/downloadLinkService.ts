import { prisma } from '../../prisma/client.js';
import { signJwt } from '../../lib/jwt.js';
import { decrypt } from '../../lib/encryption.js';

/**
 * Service for generating download links for backups.
 * Mirrors app/Services/Backups/DownloadLinkService.php
 */
export class DownloadLinkService {
  /**
   * Returns the URL that allows for a backup to be downloaded.
   * For daemon-stored backups, generates a signed JWT URL.
   * For S3 backups, generates a presigned S3 URL.
   */
  async handle(backup: any, user: any): Promise<string> {
    // Load server and node if needed
    const server = backup.server ?? await prisma.servers.findUnique({
      where: { id: backup.server_id },
      include: { nodes: true },
    });

    if (!server) {
      throw new Error('Server not found for backup.');
    }

    const node = server.nodes ?? await prisma.nodes.findUnique({ where: { id: server.node_id } });

    if (!node) {
      throw new Error('Node not found for server.');
    }

    if (backup.disk === 's3') {
      return this.getS3BackupUrl(backup, server);
    }

    // Generate a JWT for Wings daemon download
    const secret = decrypt(node.daemon_token);

    const token = signJwt(
      {
        backup_uuid: backup.uuid,
        server_uuid: server.uuid,
        unique_id: `${user.id}${server.uuid}`,
      },
      secret,
      {
        expiresIn: '15m',
        issuer: 'Pterodactyl Panel',
      }
    );

    const scheme = node.scheme || 'https';
    const connectionAddress = `${scheme}://${node.fqdn}:${node.daemonListen || 8080}`;

    return `${connectionAddress}/download/backup?token=${token}`;
  }

  /**
   * Returns a presigned URL for S3 backup downloads.
   * In a full implementation, this would use the AWS SDK.
   */
  private async getS3BackupUrl(backup: any, server: any): Promise<string> {
    // Placeholder for S3 presigned URL generation
    // In production, this would use @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner
    throw new Error('S3 backup download is not yet implemented. Configure Wings-based backups.');
  }
}
