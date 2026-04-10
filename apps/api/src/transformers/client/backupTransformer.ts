import { BaseClientTransformer } from './baseClientTransformer.js';

/**
 * Transforms backup models for the client API.
 * Mirrors app/Transformers/Api/Client/BackupTransformer.php
 */
export class BackupTransformer extends BaseClientTransformer {
  getResourceName(): string {
    return 'backup';
  }

  async transform(backup: any): Promise<Record<string, unknown>> {
    return {
      uuid: backup.uuid,
      is_successful: backup.is_successful,
      is_locked: backup.is_locked,
      name: backup.name,
      ignored_files: backup.ignored_files ?? [],
      checksum: backup.checksum,
      bytes: backup.bytes,
      created_at: this.formatTimestamp(backup.created_at),
      completed_at: backup.completed_at ? this.formatTimestamp(backup.completed_at) : null,
    };
  }
}
