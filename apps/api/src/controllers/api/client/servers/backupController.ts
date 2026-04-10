import { Request, Response } from 'express';
import { prisma } from '../../../../prisma/client.js';
import { fractal } from '../../../../serializers/fractal.js';
import { BackupTransformer } from '../../../../transformers/client/backupTransformer.js';
import { InitiateBackupService } from '../../../../services/backups/initiateBackupService.js';
import { DeleteBackupService } from '../../../../services/backups/deleteBackupService.js';
import { DownloadLinkService } from '../../../../services/backups/downloadLinkService.js';
import { DaemonBackupRepository } from '../../../../repositories/wings/daemonBackupRepository.js';
import { activityFromRequest } from '../../../../services/activity/activityLogService.js';
import {
  AuthorizationException,
  BadRequestHttpException,
  NotFoundHttpException,
} from '../../../../errors/index.js';
import {
  ACTION_BACKUP_READ,
  ACTION_BACKUP_CREATE,
  ACTION_BACKUP_DELETE,
  ACTION_BACKUP_DOWNLOAD,
  ACTION_BACKUP_RESTORE,
} from '../../../../permissions.js';

/**
 * Backup controller for the client API.
 * Mirrors app/Http/Controllers/Api/Client/Servers/BackupController.php
 */
export class BackupController {
  /**
   * Returns all the backups for a given server instance in a paginated result set.
   */
  async index(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const user = (req as any).user;

    if (!this.hasPermission(user, server, ACTION_BACKUP_READ)) {
      throw new AuthorizationException();
    }

    const perPage = Math.min(parseInt(req.query['per_page'] as string) || 20, 500);
    const page = parseInt(req.query['page'] as string) || 1;

    const [backups, total] = await Promise.all([
      prisma.backups.findMany({
        where: { server_id: server.id, deleted_at: null },
        orderBy: { created_at: 'desc' },
        take: perPage,
        skip: (page - 1) * perPage,
      }),
      prisma.backups.count({
        where: { server_id: server.id, deleted_at: null },
      }),
    ]);

    const nonFailedCount = await prisma.backups.count({
      where: {
        server_id: server.id,
        deleted_at: null,
        OR: [
          { completed_at: null },
          { is_successful: true },
        ],
      },
    });

    const transformer = new BackupTransformer();
    transformer.setRequest(req);

    const response = await fractal(req)
      .collection(backups)
      .transformWith(transformer)
      .setPagination(total, perPage, page)
      .addMeta({ backup_count: nonFailedCount })
      .toArray();

    res.json(response);
  }

  /**
   * Starts the backup process for a server.
   */
  async store(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const user = (req as any).user;

    if (!this.hasPermission(user, server, ACTION_BACKUP_CREATE)) {
      throw new AuthorizationException();
    }

    const service = new InitiateBackupService();
    const ignored = req.body.ignored ? String(req.body.ignored).split('\n') : [];
    service.setIgnoredFiles(ignored);

    // Only set lock status if user can delete backups
    if (this.hasPermission(user, server, ACTION_BACKUP_DELETE)) {
      service.setIsLocked(Boolean(req.body.is_locked));
    }

    const backup = await service.handle(server, req.body.name);

    await activityFromRequest(req)
      .event('server:backup.start')
      .subject(backup, 'Backup')
      .property({ name: backup.name, locked: Boolean(req.body.is_locked) })
      .log();

    const transformer = new BackupTransformer();
    transformer.setRequest(req);

    const response = await fractal(req)
      .item(backup)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  }

  /**
   * Returns information about a single backup.
   */
  async view(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const user = (req as any).user;

    if (!this.hasPermission(user, server, ACTION_BACKUP_READ)) {
      throw new AuthorizationException();
    }

    const backup = await this.getBackup(req.params['backup']!, server.id);

    const transformer = new BackupTransformer();
    transformer.setRequest(req);

    const response = await fractal(req)
      .item(backup)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  }

  /**
   * Toggles the lock status of a given backup.
   */
  async toggleLock(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const user = (req as any).user;

    if (!this.hasPermission(user, server, ACTION_BACKUP_DELETE)) {
      throw new AuthorizationException();
    }

    const backup = await this.getBackup(req.params['backup']!, server.id);
    const action = backup.is_locked ? 'server:backup.unlock' : 'server:backup.lock';

    const updated = await prisma.backups.update({
      where: { id: backup.id },
      data: { is_locked: !backup.is_locked },
    });

    await activityFromRequest(req)
      .event(action)
      .subject(backup, 'Backup')
      .property('name', backup.name)
      .log();

    const transformer = new BackupTransformer();
    transformer.setRequest(req);

    const response = await fractal(req)
      .item(updated)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  }

  /**
   * Generates a download URL for a backup.
   */
  async download(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const user = (req as any).user;

    if (!this.hasPermission(user, server, ACTION_BACKUP_DOWNLOAD)) {
      throw new AuthorizationException();
    }

    const backup = await this.getBackup(req.params['backup']!, server.id);

    if (backup.disk !== 's3' && backup.disk !== 'wings') {
      throw new BadRequestHttpException(
        'The backup requested references an unknown disk driver type and cannot be downloaded.'
      );
    }

    const downloadService = new DownloadLinkService();
    const url = await downloadService.handle(
      { ...backup, server: { ...server, node: server.nodes } },
      user
    );

    await activityFromRequest(req)
      .event('server:backup.download')
      .subject(backup, 'Backup')
      .property('name', backup.name)
      .log();

    res.json({
      object: 'signed_url',
      attributes: { url },
    });
  }

  /**
   * Handles restoring a backup.
   */
  async restore(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const user = (req as any).user;

    if (!this.hasPermission(user, server, ACTION_BACKUP_RESTORE)) {
      throw new AuthorizationException();
    }

    // Cannot restore a backup unless server is fully installed
    if (server.status !== null) {
      throw new BadRequestHttpException(
        'This server is not currently in a state that allows for a backup to be restored.'
      );
    }

    const backup = await this.getBackup(req.params['backup']!, server.id);

    if (!backup.is_successful && !backup.completed_at) {
      throw new BadRequestHttpException(
        'This backup cannot be restored at this time: not completed or failed.'
      );
    }

    let url: string | null = null;

    // If the backup is for S3, generate a download link for Wings
    if (backup.disk === 's3') {
      const downloadService = new DownloadLinkService();
      url = await downloadService.handle(
        { ...backup, server: { ...server, node: server.nodes } },
        user
      );
    }

    // Mark server as restoring
    await prisma.servers.update({
      where: { id: server.id },
      data: { status: 'restoring_backup' },
    });

    // Tell Wings to restore the backup
    const daemonRepo = new DaemonBackupRepository();
    daemonRepo.setServer(server);
    await daemonRepo.restore(backup, url, Boolean(req.body.truncate));

    await activityFromRequest(req)
      .event('server:backup.restore')
      .subject(backup, 'Backup')
      .property({ name: backup.name, truncate: Boolean(req.body.truncate) })
      .log();

    res.status(204).json();
  }

  /**
   * Deletes a backup.
   */
  async delete(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const user = (req as any).user;

    if (!this.hasPermission(user, server, ACTION_BACKUP_DELETE)) {
      throw new AuthorizationException();
    }

    const backup = await this.getBackup(req.params['backup']!, server.id);

    const deleteService = new DeleteBackupService();
    await deleteService.handle({ ...backup, server: { ...server, node: server.nodes } });

    await activityFromRequest(req)
      .event('server:backup.delete')
      .subject(backup, 'Backup')
      .property({ name: backup.name, failed: !backup.is_successful })
      .log();

    res.status(204).json();
  }

  /**
   * Retrieve a backup by UUID and verify it belongs to the server.
   */
  private async getBackup(backupUuid: string, serverId: number): Promise<any> {
    const backup = await prisma.backups.findFirst({
      where: {
        uuid: backupUuid,
        server_id: serverId,
        deleted_at: null,
      },
    });

    if (!backup) {
      throw new NotFoundHttpException('The requested backup could not be found.');
    }

    return backup;
  }

  /**
   * Check if a user has a specific permission on the server.
   */
  private hasPermission(user: any, server: any, permission: string): boolean {
    if (user.root_admin) return true;
    if (server.owner_id === user.id) return true;

    const subuser = (user as any).subuser;
    if (subuser && Array.isArray(subuser.permissions)) {
      return subuser.permissions.includes(permission);
    }

    return false;
  }
}

export const backupController = new BackupController();
