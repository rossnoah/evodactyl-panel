import type { Request, Response } from '@/types/express.js';
import { BadRequestHttpException, HttpForbiddenException } from '../../../../errors/index.js';
import { prisma } from '../../../../prisma/client.js';
import { activityFromRequest } from '../../../../services/activity/activityLogService.js';

/**
 * Handles updating the state of a backup from the Wings daemon.
 * Mirrors app/Http/Controllers/Api/Remote/Backups/BackupStatusController.php
 */
export class BackupStatusController {
    /**
     * Handles updating the state of a backup (complete or failed).
     */
    async index(req: Request, res: Response): Promise<void> {
        const node = (req as any).node;
        const backupUuid = req.params.backup!;

        const backup = await prisma.backups.findFirst({
            where: { uuid: backupUuid, deleted_at: null },
            include: { servers: true },
        });

        if (!backup) {
            throw new BadRequestHttpException('Backup not found.');
        }

        // Verify the backup belongs to a server on the requesting node
        if (backup.servers.node_id !== node.id) {
            throw new HttpForbiddenException('Requesting node does not have permission to access this server.');
        }

        if (backup.is_successful) {
            throw new BadRequestHttpException(
                'Cannot update the status of a backup that is already marked as completed.',
            );
        }

        const successful = Boolean(req.body.successful);
        const action = successful ? 'server:backup.complete' : 'server:backup.fail';

        // Update the backup record
        await prisma.backups.update({
            where: { id: backup.id },
            data: {
                is_successful: successful,
                // Unlock failed backups so they can be deleted
                is_locked: successful ? backup.is_locked : false,
                checksum: successful ? `${req.body.checksum_type}:${req.body.checksum}` : null,
                bytes: successful ? parseInt(req.body.size, 10) || 0 : 0,
                completed_at: new Date(),
            },
        });

        // Log the activity
        await activityFromRequest(req)
            .event(action)
            .subject({ id: Number(backup.id) }, 'Backup')
            .property('name', backup.name)
            .log();

        // Handle S3 multipart completion if applicable
        if (backup.disk === 's3' && backup.upload_id) {
            // In production, this would complete or abort the S3 multipart upload
            // using the AWS SDK based on whether the backup was successful
        }

        res.status(204).json();
    }

    /**
     * Handles toggling the restoration status of a server.
     */
    async restore(req: Request, res: Response): Promise<void> {
        const node = (req as any).node;
        const backupUuid = req.params.backup!;

        const backup = await prisma.backups.findFirst({
            where: { uuid: backupUuid, deleted_at: null },
            include: { servers: { include: { nodes: true } } },
        });

        if (!backup) {
            throw new BadRequestHttpException('Backup not found.');
        }

        // Verify the backup belongs to a server on the requesting node
        if (backup.servers.node_id !== node.id) {
            throw new HttpForbiddenException('Requesting node does not have permission to access this server.');
        }

        // Reset the server status back to null
        await prisma.servers.update({
            where: { id: backup.servers.id },
            data: { status: null },
        });

        const successful = Boolean(req.body.successful);
        const eventName = successful ? 'server:backup.restore-complete' : 'server:backup.restore-failed';

        await activityFromRequest(req)
            .event(eventName)
            .subject({ id: Number(backup.id) }, 'Backup')
            .property('name', backup.name)
            .log();

        res.status(204).json();
    }
}

export const backupStatusController = new BackupStatusController();
