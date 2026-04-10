import { prisma } from '../../prisma/client.js';
import { generateUuid } from '../../lib/uuid.js';

/**
 * Fluent activity logging service.
 * Mirrors app/Services/Activity/ActivityLogService.php
 */
export class ActivityLogService {
  private eventName: string = '';
  private actorType: string | null = null;
  private actorId: number | null = null;
  private apiKeyId: number | null = null;
  private ipAddress: string = '';
  private description: string | null = null;
  private properties: Record<string, unknown> = {};
  private subjects: Array<{ type: string; id: number }> = [];
  private batchUuid: string | null = null;

  /**
   * Set the event name.
   */
  event(name: string): this {
    this.eventName = name;
    return this;
  }

  /**
   * Set the actor (user who performed the action).
   */
  actor(user: { id: number } | null): this {
    if (user) {
      this.actorType = 'Pterodactyl\\Models\\User';
      this.actorId = user.id;
    }
    return this;
  }

  /**
   * Set the IP address.
   */
  ip(ip: string): this {
    this.ipAddress = ip;
    return this;
  }

  /**
   * Set the API key that triggered this action.
   */
  withApiKey(apiKey: { id: number } | null): this {
    if (apiKey) {
      this.apiKeyId = apiKey.id;
    }
    return this;
  }

  /**
   * Add a subject to this log entry.
   */
  subject(model: { id: number }, type: string): this {
    this.subjects.push({ type, id: model.id });
    return this;
  }

  /**
   * Add a property to this log entry.
   */
  property(key: string, value: unknown): this;
  property(properties: Record<string, unknown>): this;
  property(keyOrProperties: string | Record<string, unknown>, value?: unknown): this {
    if (typeof keyOrProperties === 'string') {
      this.properties[keyOrProperties] = value;
    } else {
      this.properties = { ...this.properties, ...keyOrProperties };
    }
    return this;
  }

  /**
   * Set the batch UUID for grouping related activities.
   */
  batch(uuid: string): this {
    this.batchUuid = uuid;
    return this;
  }

  /**
   * Set the description.
   */
  describe(description: string): this {
    this.description = description;
    return this;
  }

  /**
   * Log the activity and optionally run a callback within a transaction.
   */
  async log(): Promise<void> {
    const activityLog = await prisma.activity_logs.create({
      data: {
        batch: this.batchUuid ?? null,
        event: this.eventName,
        ip: this.ipAddress,
        description: this.description,
        actor_type: this.actorType,
        actor_id: this.actorId ? BigInt(this.actorId) : null,
        api_key_id: this.apiKeyId,
        properties: JSON.stringify(this.properties),
        timestamp: new Date(),
      },
    });

    // Create subject entries
    if (this.subjects.length > 0) {
      await prisma.activity_log_subjects.createMany({
        data: this.subjects.map(subject => ({
          activity_log_id: activityLog.id,
          subject_type: subject.type,
          subject_id: BigInt(subject.id),
        })),
      });
    }
  }

  /**
   * Run a callback within a transaction, logging the activity on success.
   */
  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    return prisma.$transaction(async () => {
      const result = await callback();
      await this.log();
      return result;
    });
  }
}

/**
 * Create a new activity log builder.
 */
export function activity(): ActivityLogService {
  return new ActivityLogService();
}

/**
 * Create an activity log builder from a request context.
 */
export function activityFromRequest(req: any): ActivityLogService {
  const service = new ActivityLogService();

  if (req.user) {
    service.actor(req.user);
  }

  if (req.ip) {
    service.ip(req.ip);
  }

  if (req.apiKey) {
    service.withApiKey(req.apiKey);
  }

  return service;
}
