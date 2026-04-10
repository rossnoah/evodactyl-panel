import { BaseClientTransformer } from './baseClientTransformer.js';

/**
 * Transformer for the Client API UserSSHKey resource.
 * Mirrors app/Transformers/Api/Client/UserSSHKeyTransformer.php
 */
export class UserSSHKeyTransformer extends BaseClientTransformer {
  getResourceName(): string {
    return 'ssh_key';
  }

  transform(model: any): Record<string, unknown> {
    return {
      name: model.name,
      fingerprint: model.fingerprint,
      public_key: model.public_key,
      created_at: this.formatTimestamp(model.created_at),
    };
  }
}
