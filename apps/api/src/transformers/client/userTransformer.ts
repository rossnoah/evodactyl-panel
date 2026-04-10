import crypto from 'node:crypto';
import { BaseClientTransformer } from './baseClientTransformer.js';

/**
 * Transformer for the Client API User resource.
 * Shows limited user info suitable for non-admin consumers.
 * Mirrors app/Transformers/Api/Client/UserTransformer.php
 */
export class ClientUserTransformer extends BaseClientTransformer {
  getResourceName(): string {
    return 'user';
  }

  transform(model: any): Record<string, unknown> {
    return {
      uuid: model.uuid,
      username: model.username,
      email: model.email,
      image: 'https://gravatar.com/avatar/' + crypto.createHash('md5').update((model.email || '').toLowerCase()).digest('hex'),
      '2fa_enabled': Boolean(model.use_totp),
      created_at: this.formatTimestamp(model.created_at),
    };
  }
}
