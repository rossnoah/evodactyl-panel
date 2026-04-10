import { BaseTransformer } from './baseTransformer.js';

/**
 * Egg variable transformer for Application API responses.
 * Mirrors app/Transformers/Api/Application/EggVariableTransformer.php
 */
export class EggVariableTransformer extends BaseTransformer {
  getResourceName(): string {
    return 'egg_variable';
  }

  transform(model: any): Record<string, unknown> {
    return {
      id: model.id,
      egg_id: model.egg_id,
      name: model.name,
      description: model.description,
      env_variable: model.env_variable,
      default_value: model.default_value,
      user_viewable: Boolean(model.user_viewable),
      user_editable: Boolean(model.user_editable),
      rules: model.rules,
      created_at: this.formatTimestamp(model.created_at),
      updated_at: this.formatTimestamp(model.updated_at),
    };
  }
}
