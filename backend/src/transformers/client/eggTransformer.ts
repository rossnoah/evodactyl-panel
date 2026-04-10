import { BaseClientTransformer } from './baseClientTransformer.js';

/**
 * Egg transformer for Client API responses.
 * Mirrors app/Transformers/Api/Client/EggTransformer.php
 */
export class ClientEggTransformer extends BaseClientTransformer {
  getResourceName(): string {
    return 'egg';
  }

  transform(model: any): Record<string, unknown> {
    return {
      uuid: model.uuid,
      name: model.name,
    };
  }
}
