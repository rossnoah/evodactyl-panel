import type { Request, Response } from '@/types/express.js';
import { BadRequestHttpException, ConflictHttpException, HttpForbiddenException } from '../../../../errors/index.js';
import { prisma } from '../../../../prisma/client.js';

/**
 * Returns the required presigned URLs to upload a backup to S3 cloud storage.
 * Mirrors app/Http/Controllers/Api/Remote/Backups/BackupRemoteUploadController.php
 */

const DEFAULT_MAX_PART_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB

export class BackupRemoteUploadController {
    /**
     * Handle the incoming request from a Wings daemon to get S3 upload URLs.
     */
    async handle(req: Request, res: Response): Promise<void> {
        const node = (req as any).node;
        const backupUuid = req.params.backup!;

        const size = parseInt(req.query.size as string, 10);
        if (!size || size <= 0) {
            throw new BadRequestHttpException('A non-empty "size" query parameter must be provided.');
        }

        const backup = await prisma.backups.findFirst({
            where: { uuid: backupUuid, deleted_at: null },
            include: { servers: true },
        });

        if (!backup) {
            throw new BadRequestHttpException('Backup not found.');
        }

        // Check that the backup belongs to a server on the requesting node
        if (backup.servers.node_id !== node.id) {
            throw new HttpForbiddenException('Requesting node does not have permission to access this server.');
        }

        // Prevent completed backups from being re-uploaded
        if (backup.completed_at !== null) {
            throw new ConflictHttpException('This backup is already in a completed state.');
        }

        // S3 multipart upload logic
        // In production, this would use the AWS SDK to create multipart upload presigned URLs
        const maxPartSize = this.getConfiguredMaxPartSize();

        // Placeholder response - in production this would generate real S3 presigned URLs
        const partCount = Math.ceil(size / maxPartSize);
        const parts: string[] = [];
        for (let i = 0; i < partCount; i++) {
            parts.push(`https://s3.example.com/upload-part-${i + 1}`);
        }

        // Update the backup with an upload_id
        const uploadId = `upload-${backupUuid}-${Date.now()}`;
        await prisma.backups.update({
            where: { id: backup.id },
            data: { upload_id: uploadId },
        });

        res.json({
            parts,
            part_size: maxPartSize,
        });
    }

    private getConfiguredMaxPartSize(): number {
        const configured = parseInt(process.env.BACKUP_MAX_PART_SIZE ?? '0', 10);
        return configured > 0 ? configured : DEFAULT_MAX_PART_SIZE;
    }
}

export const backupRemoteUploadController = new BackupRemoteUploadController();
