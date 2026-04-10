import { Request } from 'express';
import type { SerializedResource } from '../../serializers/jsonApi.js';

/**
 * Base transformer for Application API responses.
 * Mirrors app/Transformers/Api/Application/BaseTransformer.php
 */
export abstract class BaseTransformer {
  static readonly RESPONSE_TIMEZONE = 'UTC';

  protected request: Request | null = null;

  /**
   * Return the resource name for the JSON:API output.
   */
  abstract getResourceName(): string;

  /**
   * Transform a model into an array for the response.
   */
  abstract transform(model: unknown): Record<string, unknown> | Promise<Record<string, unknown>>;

  /**
   * Available includes that can be requested via ?include=.
   */
  getAvailableIncludes(): string[] {
    return [];
  }

  /**
   * Default includes that are always loaded.
   */
  getDefaultIncludes(): string[] {
    return [];
  }

  /**
   * Set the request on this transformer instance.
   */
  setRequest(request: Request): this {
    this.request = request;
    return this;
  }

  /**
   * Create a transformer instance with the request set.
   */
  static fromRequest<T extends BaseTransformer>(
    this: new () => T,
    request: Request
  ): T {
    const instance = new this();
    instance.setRequest(request);
    return instance;
  }

  /**
   * Format a timestamp as ISO-8601 in UTC.
   * Matches Laravel's CarbonImmutable::toAtomString().
   */
  protected formatTimestamp(timestamp: string | Date | null): string | null {
    if (!timestamp) return null;
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    // Match PHP CarbonImmutable::toAtomString() — RFC 3339 without milliseconds
    return date.toISOString().replace(/\.\d{3}Z$/, '+00:00');
  }

  /**
   * Check if the current API key has authorization for a resource.
   * Used when including related resources.
   */
  protected authorize(_resource: string): boolean {
    if (!this.request) return false;
    const user = (this.request as any).user;
    const apiKey = (this.request as any).apiKey;

    if (!user) return false;

    // Session-based auth (SPA) — admin users get full access
    if (!apiKey) {
      return Boolean(user.root_admin);
    }

    // Account-type keys check root admin
    if (apiKey.key_type === 1) {
      return Boolean(user.root_admin);
    }

    // Application-type keys check ACL
    // This will be fully implemented in Phase 2B with AdminAcl
    return true;
  }

  /**
   * Create an instance of another transformer with the same request context.
   */
  protected makeTransformer<T extends BaseTransformer>(
    TransformerClass: new () => T
  ): T {
    const instance = new TransformerClass();
    if (this.request) {
      instance.setRequest(this.request);
    }
    return instance;
  }
}
