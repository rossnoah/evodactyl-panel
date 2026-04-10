import { DisplayException, TooManyRequestsHttpException } from '../../errors/index.js';
import { generateUuid } from '../../lib/uuid.js';
import { prisma } from '../../prisma/client.js';
import { lockRowForUpdate } from '../../prisma/locks.js';
import { DaemonBackupRepository } from '../../repositories/wings/daemonBackupRepository.js';

/**
 * Service for initiating server backups.
 * Mirrors app/Services/Backups/InitiateBackupService.php
 */
export class InitiateBackupService {
    private ignoredFiles: string[] = [];
    private isLocked: boolean = false;

    /**
     * Set if the backup should be locked once created.
     */
    setIsLocked(isLocked: boolean): this {
        this.isLocked = isLocked;
        return this;
    }

    /**
     * Sets the files to be ignored by this backup.
     */
    setIgnoredFiles(ignored: string[] | null): this {
        if (Array.isArray(ignored)) {
            this.ignoredFiles = ignored.filter((value) => value.length > 0);
        } else {
            this.ignoredFiles = [];
        }
        return this;
    }

    /**
     * Initiates the backup process for a server on Wings.
     */
    async handle(server: any, name?: string | null, override: boolean = false): Promise<any> {
        const throttleLimit = parseInt(process.env.BACKUP_THROTTLE_LIMIT ?? '2', 10);
        const throttlePeriod = parseInt(process.env.BACKUP_THROTTLE_PERIOD ?? '600', 10);
        const defaultAdapter = process.env.BACKUP_DRIVER ?? 'wings';
        const backupName = name?.trim() || `Backup at ${new Date().toISOString()}`;

        // Throttle, limit-check, optional oldest-rotate, and create all run
        // inside one transaction with a row lock on the server. Concurrent
        // backup requests for the same server serialize on this lock so they
        // cannot race past `server.backup_limit` or `BACKUP_THROTTLE_LIMIT`.
        // Wings notification happens after commit.
        const backup = await prisma.$transaction(async (tx) => {
            await lockRowForUpdate(tx, 'servers', server.id);

            if (throttlePeriod > 0) {
                const since = new Date(Date.now() - throttlePeriod * 1000);
                const recentCount = await tx.backups.count({
                    where: {
                        server_id: server.id,
                        created_at: { gte: since },
                        deleted_at: null,
                    },
                });

                if (recentCount >= throttleLimit) {
                    throw new TooManyRequestsHttpException(
                        `Only ${throttleLimit} backups may be generated within a ${throttlePeriod} second span of time.`,
                    );
                }
            }

            // Non-failed backups = completed_at is null (ongoing) OR is_successful is true.
            const successfulCount = await tx.backups.count({
                where: {
                    server_id: server.id,
                    deleted_at: null,
                    OR: [{ completed_at: null }, { is_successful: true }],
                },
            });

            if (!server.backup_limit || successfulCount >= server.backup_limit) {
                if (!override || server.backup_limit <= 0) {
                    throw new DisplayException(
                        `This server has reached its backup limit of ${server.backup_limit}.`,
                        400,
                    );
                }

                const oldest = await tx.backups.findFirst({
                    where: {
                        server_id: server.id,
                        is_locked: false,
                        deleted_at: null,
                        OR: [{ completed_at: null }, { is_successful: true }],
                    },
                    orderBy: { created_at: 'asc' },
                });

                if (!oldest) {
                    throw new DisplayException(
                        `This server has reached its backup limit of ${server.backup_limit}.`,
                        400,
                    );
                }

                await tx.backups.update({
                    where: { id: oldest.id },
                    data: { deleted_at: new Date() },
                });
            }

            return tx.backups.create({
                data: {
                    server_id: server.id,
                    uuid: generateUuid(),
                    name: backupName,
                    ignored_files: JSON.stringify(this.ignoredFiles),
                    disk: defaultAdapter,
                    is_locked: this.isLocked,
                },
            });
        });

        // Tell Wings to start the backup
        const node = server.nodes ?? (await prisma.nodes.findUnique({ where: { id: server.node_id } }));
        const daemonRepo = new DaemonBackupRepository();
        daemonRepo.setServer({ ...server, node });
        daemonRepo.setBackupAdapter(defaultAdapter);

        try {
            await daemonRepo.backup({
                uuid: backup.uuid,
                ignored_files: this.ignoredFiles,
            });
        } catch (error) {
            // If Wings fails, mark the backup as failed
            await prisma.backups.update({
                where: { id: backup.id },
                data: {
                    is_successful: false,
                    completed_at: new Date(),
                },
            });
            throw error;
        }

        return backup;
    }
}
