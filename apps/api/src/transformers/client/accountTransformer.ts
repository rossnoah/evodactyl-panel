import { BaseClientTransformer } from './baseClientTransformer.js';

/**
 * Transformer for the Client API Account resource.
 * Mirrors app/Transformers/Api/Client/AccountTransformer.php
 */
export class AccountTransformer extends BaseClientTransformer {
  getResourceName(): string {
    return 'user';
  }

  transform(model: any): Record<string, unknown> {
    return {
      id: model.id,
      admin: Boolean(model.root_admin),
      username: model.username,
      email: model.email,
      first_name: model.name_first,
      last_name: model.name_last,
      language: model.language,
    };
  }
}
