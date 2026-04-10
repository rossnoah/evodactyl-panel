import crypto from 'node:crypto';
import { BaseClientTransformer } from './baseClientTransformer.js';
import { ClientUserTransformer } from './userTransformer.js';
import { serializeItem, serializeNull } from '../../serializers/jsonApi.js';

/**
 * Transformer for the Client API ActivityLog resource.
 * Mirrors app/Transformers/Api/Client/ActivityLogTransformer.php
 */
export class ActivityLogTransformer extends BaseClientTransformer {
  getResourceName(): string {
    return 'activity_log';
  }

  getAvailableIncludes(): string[] {
    return ['actor'];
  }

  transform(model: any): Record<string, unknown> {
    return {
      id: crypto.createHash('sha1').update(String(model.id)).digest('hex'),
      batch: model.batch,
      event: model.event,
      is_api: model.api_key_id !== null && model.api_key_id !== undefined,
      ip: this.canViewIP(model.actor) ? model.ip : null,
      description: model.description,
      properties: this.transformProperties(model),
      has_additional_metadata: this.hasAdditionalMetadata(model),
      timestamp: this.formatTimestamp(model.timestamp),
    };
  }

  /**
   * Include the actor (user) who performed the activity.
   */
  async includeActor(model: any): Promise<any> {
    if (!model.actor) {
      return serializeNull();
    }

    const transformer = this.makeTransformer(ClientUserTransformer);
    const transformed = transformer.transform(model.actor);
    return serializeItem(transformer.getResourceName(), transformed);
  }

  /**
   * Transform properties, converting arrays into countable fields.
   */
  private transformProperties(model: any): Record<string, unknown> {
    let properties: Record<string, unknown> = {};

    if (model.properties) {
      try {
        properties = typeof model.properties === 'string'
          ? JSON.parse(model.properties)
          : model.properties;
      } catch {
        return {};
      }
    }

    if (!properties || Object.keys(properties).length === 0) {
      return {};
    }

    const requestUser = this.getUser();
    const result: Record<string, unknown> = {};
    const countKeys: string[] = [];

    for (const [key, value] of Object.entries(properties)) {
      // Hide IP if actor is not the current user
      if (key === 'ip' && model.actor && requestUser && model.actor.id !== requestUser.id) {
        result[key] = '[hidden]';
        continue;
      }

      if (!Array.isArray(value)) {
        if (key === 'directory' && typeof value === 'string') {
          result[key] = ('/' + value.replace(/^\/+|\/+$/g, '') + '/').replace(/\/\//g, '/');
        } else {
          result[key] = value;
        }
      } else {
        result[key] = value;
        const countKey = `${key}_count`;
        result[countKey] = value.length;
        countKeys.push(countKey);
      }
    }

    // If there's exactly one count key, add a generic 'count' and remove the specific one
    if (countKeys.length === 1) {
      result['count'] = result[countKeys[0]];
      delete result[countKeys[0]];
    }

    return result;
  }

  /**
   * Determines if there are additional metadata properties not exposed
   * in the response language string.
   */
  private hasAdditionalMetadata(model: any): boolean {
    let properties: Record<string, unknown> = {};

    if (model.properties) {
      try {
        properties = typeof model.properties === 'string'
          ? JSON.parse(model.properties)
          : model.properties;
      } catch {
        return false;
      }
    }

    if (!properties || Object.keys(properties).length === 0) {
      return false;
    }

    // Extract property keys referenced in the event translation string
    const eventKey = (model.event || '').replace(/:/g, '.');
    // Since we don't have Laravel's trans() function, we do a simplified check:
    // exclude known metadata keys
    const exclude = ['ip', 'useragent', 'using_sftp'];

    for (const key of Object.keys(properties)) {
      if (!exclude.includes(key)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if the current user can view the IP address.
   */
  private canViewIP(actor: any): boolean {
    const requestUser = this.getUser();
    if (!requestUser) return false;

    // User can see their own IP or if they are a root admin
    if (actor && actor.id === requestUser.id) return true;
    if (requestUser.root_admin) return true;

    return false;
  }
}
