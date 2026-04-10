import { BaseClientTransformer } from './baseClientTransformer.js';

/**
 * Transforms a subuser into a model that can be shown to a front-end user.
 * Merges user data with permissions.
 * Mirrors app/Transformers/Api/Client/SubuserTransformer.php
 */
export class SubuserTransformer extends BaseClientTransformer {
  getResourceName(): string {
    return 'subuser';
  }

  async transform(model: any): Promise<Record<string, unknown>> {
    const user = model.users ?? model;

    return {
      uuid: user.uuid,
      username: user.username,
      email: user.email,
      image: `https://gravatar.com/avatar/${user.email ?? ''}`,
      '2fa_enabled': user.use_totp ?? false,
      created_at: this.formatTimestamp(user.created_at),
      permissions: model.permissions ?? [],
    };
  }
}
