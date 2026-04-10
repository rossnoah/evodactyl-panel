/**
 * Validation schemas for schedule-related requests.
 * Mirrors the Laravel FormRequest validation from:
 * - app/Http/Requests/Api/Client/Servers/Schedules/StoreScheduleRequest.php
 * - app/Http/Requests/Api/Client/Servers/Schedules/UpdateScheduleRequest.php
 * - app/Http/Requests/Api/Client/Servers/Schedules/StoreTaskRequest.php
 */

export interface StoreScheduleInput {
  name: string;
  is_active: boolean;
  only_when_online?: boolean;
  minute: string;
  hour: string;
  day_of_month: string;
  month: string;
  day_of_week: string;
}

export interface StoreTaskInput {
  action: 'command' | 'power' | 'backup';
  payload: string;
  time_offset: number;
  sequence_id?: number;
  continue_on_failure?: boolean;
}

/**
 * Validate the store/update schedule request body.
 */
export function validateSchedule(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!body.name || typeof body.name !== 'string') {
    errors.push('The name field is required and must be a string.');
  } else if (body.name.length > 191) {
    errors.push('The name may not be greater than 191 characters.');
  }

  // Cron fields are required strings
  const cronFields = ['minute', 'hour', 'day_of_month', 'month', 'day_of_week'];
  for (const field of cronFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      errors.push(`The ${field} field is required.`);
    } else if (typeof body[field] !== 'string') {
      errors.push(`The ${field} field must be a string.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate the store/update task request body.
 */
export function validateTask(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const validActions = ['command', 'power', 'backup'];
  if (!body.action || !validActions.includes(body.action)) {
    errors.push(`The action field is required and must be one of: ${validActions.join(', ')}.`);
  }

  if (body.payload !== undefined && body.payload !== null && typeof body.payload !== 'string') {
    errors.push('The payload field must be a string.');
  }

  if (body.time_offset !== undefined && body.time_offset !== null) {
    const offset = parseInt(body.time_offset, 10);
    if (isNaN(offset) || offset < 0 || offset > 900) {
      errors.push('The time_offset must be between 0 and 900.');
    }
  }

  if (body.sequence_id !== undefined && body.sequence_id !== null) {
    const seqId = parseInt(body.sequence_id, 10);
    if (isNaN(seqId) || seqId < 1) {
      errors.push('The sequence_id must be at least 1.');
    }
  }

  return { valid: errors.length === 0, errors };
}
