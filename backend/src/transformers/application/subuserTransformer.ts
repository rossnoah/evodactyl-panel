import { BaseTransformer } from './baseTransformer.js';

/**
 * Application API subuser transformer.
 * Mirrors app/Transformers/Api/Application/SubuserTransformer.php
 */
export class ApplicationSubuserTransformer extends BaseTransformer {
  getAvailableIncludes(): string[] {
    return ['user', 'server'];
  }

  getResourceName(): string {
    return 'subuser';
  }

  async transform(subuser: any): Promise<Record<string, unknown>> {
    return {
      id: subuser.id,
      user_id: subuser.user_id,
      server_id: subuser.server_id,
      permissions: subuser.permissions,
      created_at: this.formatTimestamp(subuser.created_at),
      updated_at: this.formatTimestamp(subuser.updated_at),
    };
  }
}
