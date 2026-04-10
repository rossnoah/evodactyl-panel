import { BaseClientTransformer } from './baseClientTransformer.js';

/**
 * Transformer for the Client API ApiKey resource.
 * Mirrors app/Transformers/Api/Client/ApiKeyTransformer.php
 */
export class ApiKeyTransformer extends BaseClientTransformer {
  getResourceName(): string {
    return 'api_key';
  }

  transform(model: any): Record<string, unknown> {
    return {
      identifier: model.identifier,
      description: model.memo,
      allowed_ips: model.allowed_ips == null ? null : (typeof model.allowed_ips === 'string' ? JSON.parse(model.allowed_ips) : model.allowed_ips),
      last_used_at: model.last_used_at ? this.formatTimestamp(model.last_used_at) : null,
      created_at: this.formatTimestamp(model.created_at),
    };
  }
}
