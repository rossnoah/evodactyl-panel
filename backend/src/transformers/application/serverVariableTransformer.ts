import { BaseTransformer } from './baseTransformer.js';
import { serializeNull, type SerializedResource } from '../../serializers/jsonApi.js';

/**
 * Transformer for server variable models in the Application API.
 * Mirrors app/Transformers/Api/Application/ServerVariableTransformer.php
 */
export class ServerVariableTransformer extends BaseTransformer {
  getResourceName(): string {
    return 'server_variable';
  }

  getAvailableIncludes(): string[] {
    return ['parent'];
  }

  transform(variable: any): Record<string, unknown> {
    return {
      id: variable.id,
      egg_id: variable.egg_id,
      name: variable.name,
      description: variable.description,
      env_variable: variable.env_variable,
      default_value: variable.default_value,
      user_viewable: variable.user_viewable,
      user_editable: variable.user_editable,
      rules: variable.rules,
      server_value: variable.server_value ?? variable.default_value,
      created_at: this.formatTimestamp(variable.created_at),
      updated_at: this.formatTimestamp(variable.updated_at),
    };
  }

  async includeParent(variable: any): Promise<SerializedResource> {
    if (!this.authorize('eggs')) {
      return serializeNull();
    }

    // Parent egg variable transformation would go here
    return serializeNull();
  }
}
