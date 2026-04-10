import { BaseClientTransformer } from './baseClientTransformer.js';

/**
 * Transformer for egg variable models in the Client API.
 * Mirrors app/Transformers/Api/Client/EggVariableTransformer.php
 */
export class EggVariableTransformer extends BaseClientTransformer {
  getResourceName(): string {
    return 'egg_variable';
  }

  transform(variable: any): Record<string, unknown> {
    if (!variable.user_viewable) {
      throw new Error('Cannot transform a hidden egg variable in a client transformer.');
    }

    return {
      name: variable.name,
      description: variable.description,
      env_variable: variable.env_variable,
      default_value: variable.default_value,
      server_value: variable.server_value,
      is_editable: Boolean(variable.user_editable),
      rules: variable.rules,
    };
  }
}
