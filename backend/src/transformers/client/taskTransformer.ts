import { BaseClientTransformer } from './baseClientTransformer.js';

/**
 * Transforms a schedule task into a client viewable format.
 * Mirrors app/Transformers/Api/Client/TaskTransformer.php
 */
export class TaskTransformer extends BaseClientTransformer {
  getResourceName(): string {
    return 'schedule_task';
  }

  async transform(model: any): Promise<Record<string, unknown>> {
    return {
      id: model.id,
      sequence_id: model.sequence_id,
      action: model.action,
      payload: model.payload,
      time_offset: model.time_offset,
      is_queued: model.is_queued,
      continue_on_failure: model.continue_on_failure,
      created_at: this.formatTimestamp(model.created_at),
      updated_at: this.formatTimestamp(model.updated_at),
    };
  }
}
