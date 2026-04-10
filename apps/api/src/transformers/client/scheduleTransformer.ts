import { BaseClientTransformer } from './baseClientTransformer.js';
import { TaskTransformer } from './taskTransformer.js';
import { serializeCollection, type SerializedResource } from '../../serializers/jsonApi.js';

/**
 * Transforms schedule models for the client API.
 * Mirrors app/Transformers/Api/Client/ScheduleTransformer.php
 */
export class ScheduleTransformer extends BaseClientTransformer {
  getAvailableIncludes(): string[] {
    return ['tasks'];
  }

  getDefaultIncludes(): string[] {
    return ['tasks'];
  }

  getResourceName(): string {
    return 'schedule';
  }

  async transform(model: any): Promise<Record<string, unknown>> {
    return {
      id: model.id,
      name: model.name,
      cron: {
        day_of_week: model.cron_day_of_week,
        day_of_month: model.cron_day_of_month,
        month: model.cron_month,
        hour: model.cron_hour,
        minute: model.cron_minute,
      },
      is_active: model.is_active,
      is_processing: model.is_processing,
      only_when_online: model.only_when_online,
      last_run_at: model.last_run_at ? this.formatTimestamp(model.last_run_at) : null,
      next_run_at: model.next_run_at ? this.formatTimestamp(model.next_run_at) : null,
      created_at: this.formatTimestamp(model.created_at),
      updated_at: this.formatTimestamp(model.updated_at),
    };
  }

  /**
   * Include tasks for the schedule.
   */
  async includeTasks(model: any): Promise<SerializedResource> {
    const tasks = model.tasks ?? [];
    const taskTransformer = this.makeTransformer(TaskTransformer);

    const transformedTasks = [];
    for (const task of tasks) {
      const transformed = await taskTransformer.transform(task);
      transformedTasks.push({
        object: taskTransformer.getResourceName(),
        attributes: transformed,
      });
    }

    return {
      object: 'list',
      data: transformedTasks,
    } as SerializedResource;
  }
}
