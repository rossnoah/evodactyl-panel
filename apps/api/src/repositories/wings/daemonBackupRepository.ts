import { DaemonRepository } from './daemonRepository.js';

/**
 * Repository for communicating with Wings daemon for backup operations.
 * Mirrors app/Repositories/Wings/DaemonBackupRepository.php
 */
export class DaemonBackupRepository extends DaemonRepository {
  protected server: any;
  protected adapter: string | null = null;

  /**
   * Set the server to operate on.
   */
  setServer(server: any): this {
    this.server = server;
    if (server.nodes) {
      this.setNode(server.nodes);
    }
    return this;
  }

  /**
   * Sets the backup adapter for this execution instance.
   */
  setBackupAdapter(adapter: string): this {
    this.adapter = adapter;
    return this;
  }

  /**
   * Tells the remote Daemon to begin generating a backup for the server.
   */
  async backup(backup: any): Promise<Response> {
    const ignoredFiles = Array.isArray(backup.ignored_files) ? backup.ignored_files : [];

    return this.post(`/api/servers/${this.server.uuid}/backup`, {
      adapter: this.adapter ?? 'wings',
      uuid: backup.uuid,
      ignore: ignoredFiles.join('\n'),
    });
  }

  /**
   * Sends a request to Wings to begin restoring a backup for a server.
   */
  async restore(backup: any, url: string | null = null, truncate: boolean = false): Promise<Response> {
    return this.post(`/api/servers/${this.server.uuid}/backup/${backup.uuid}/restore`, {
      adapter: backup.disk,
      truncate_directory: truncate,
      download_url: url ?? '',
    });
  }

  /**
   * Deletes a backup from the daemon.
   */
  async deleteBackup(backup: any): Promise<Response> {
    return this.delete(`/api/servers/${this.server.uuid}/backup/${backup.uuid}`);
  }
}
