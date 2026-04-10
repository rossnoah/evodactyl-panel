import { BaseClientTransformer } from './baseClientTransformer.js';

/**
 * Transform a file object response from the daemon into a standardized response.
 * Mirrors app/Transformers/Api/Client/FileObjectTransformer.php
 */
export class FileObjectTransformer extends BaseClientTransformer {
  getResourceName(): string {
    return 'file_object';
  }

  async transform(item: any): Promise<Record<string, unknown>> {
    return {
      name: item.name ?? null,
      mode: item.mode ?? null,
      mode_bits: item.mode_bits ?? null,
      size: item.size ?? 0,
      is_file: item.file ?? true,
      is_symlink: item.symlink ?? false,
      mimetype: item.mime ?? 'application/octet-stream',
      created_at: (item.created ? new Date(item.created) : new Date()).toISOString().replace(/\.\d{3}Z$/, '+00:00'),
      modified_at: (item.modified ? new Date(item.modified) : new Date()).toISOString().replace(/\.\d{3}Z$/, '+00:00'),
    };
  }
}
