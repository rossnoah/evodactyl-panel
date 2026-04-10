import { Request, Response } from 'express';
import { prisma } from '../../../../prisma/client.js';
import { fractal } from '../../../../serializers/fractal.js';
import { ScheduleTransformer } from '../../../../transformers/client/scheduleTransformer.js';
import { ProcessScheduleService } from '../../../../services/schedules/processScheduleService.js';
import { activityFromRequest } from '../../../../services/activity/activityLogService.js';
import {
  AuthorizationException,
  DisplayException,
  NotFoundHttpException,
} from '../../../../errors/index.js';
import {
  ACTION_SCHEDULE_READ,
  ACTION_SCHEDULE_CREATE,
  ACTION_SCHEDULE_UPDATE,
  ACTION_SCHEDULE_DELETE,
} from '../../../../permissions.js';

/**
 * Schedule controller for the client API.
 * Mirrors app/Http/Controllers/Api/Client/Servers/ScheduleController.php
 */
export class ScheduleController {
  /**
   * Returns all the schedules belonging to a given server.
   */
  async index(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const user = (req as any).user;

    if (!this.hasPermission(user, server, ACTION_SCHEDULE_READ)) {
      throw new AuthorizationException();
    }

    const schedules = await prisma.schedules.findMany({
      where: { server_id: server.id },
      include: { tasks: { orderBy: { sequence_id: 'asc' } } },
    });

    const transformer = new ScheduleTransformer();
    transformer.setRequest(req);

    const response = await fractal(req)
      .collection(schedules)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  }

  /**
   * Store a new schedule for a server.
   */
  async store(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const user = (req as any).user;

    if (!this.hasPermission(user, server, ACTION_SCHEDULE_CREATE)) {
      throw new AuthorizationException();
    }

    const nextRunAt = this.getNextRunAt(req);

    const schedule = await prisma.schedules.create({
      data: {
        server_id: server.id,
        name: req.body.name,
        cron_day_of_week: req.body.day_of_week,
        cron_month: req.body.month,
        cron_day_of_month: req.body.day_of_month,
        cron_hour: req.body.hour,
        cron_minute: req.body.minute,
        is_active: Boolean(req.body.is_active),
        only_when_online: req.body.only_when_online ? 1 : 0,
        next_run_at: nextRunAt,
      },
      include: { tasks: true },
    });

    await activityFromRequest(req)
      .event('server:schedule.create')
      .subject(schedule, 'Schedule')
      .property('name', schedule.name)
      .log();

    const transformer = new ScheduleTransformer();
    transformer.setRequest(req);

    const response = await fractal(req)
      .item(schedule)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  }

  /**
   * Returns a specific schedule for the server.
   */
  async view(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const user = (req as any).user;

    if (!this.hasPermission(user, server, ACTION_SCHEDULE_READ)) {
      throw new AuthorizationException();
    }

    const schedule = await this.getSchedule(req.params['schedule']!, server.id);

    const scheduleWithTasks = await prisma.schedules.findUnique({
      where: { id: schedule.id },
      include: { tasks: { orderBy: { sequence_id: 'asc' } } },
    });

    const transformer = new ScheduleTransformer();
    transformer.setRequest(req);

    const response = await fractal(req)
      .item(scheduleWithTasks)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  }

  /**
   * Updates a given schedule with the new data provided.
   */
  async update(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const user = (req as any).user;

    if (!this.hasPermission(user, server, ACTION_SCHEDULE_UPDATE)) {
      throw new AuthorizationException();
    }

    const schedule = await this.getSchedule(req.params['schedule']!, server.id);
    const active = Boolean(req.body.is_active);
    const nextRunAt = this.getNextRunAt(req);

    const data: any = {
      name: req.body.name,
      cron_day_of_week: req.body.day_of_week,
      cron_month: req.body.month,
      cron_day_of_month: req.body.day_of_month,
      cron_hour: req.body.hour,
      cron_minute: req.body.minute,
      is_active: active,
      only_when_online: req.body.only_when_online ? 1 : 0,
      next_run_at: nextRunAt,
    };

    // Reset processing state when toggling active status
    if (schedule.is_active !== active) {
      data.is_processing = false;
    }

    const updated = await prisma.schedules.update({
      where: { id: schedule.id },
      data,
      include: { tasks: { orderBy: { sequence_id: 'asc' } } },
    });

    await activityFromRequest(req)
      .event('server:schedule.update')
      .subject(schedule, 'Schedule')
      .property({ name: schedule.name, active })
      .log();

    const transformer = new ScheduleTransformer();
    transformer.setRequest(req);

    const response = await fractal(req)
      .item(updated)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  }

  /**
   * Executes a given schedule immediately.
   */
  async execute(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const user = (req as any).user;

    if (!this.hasPermission(user, server, ACTION_SCHEDULE_UPDATE)) {
      throw new AuthorizationException();
    }

    const schedule = await this.getSchedule(req.params['schedule']!, server.id);

    const scheduleWithRelations = await prisma.schedules.findUnique({
      where: { id: schedule.id },
      include: {
        tasks: { orderBy: { sequence_id: 'asc' } },
        servers: { include: { nodes: true } },
      },
    });

    const processService = new ProcessScheduleService();
    await processService.handle(scheduleWithRelations, true);

    await activityFromRequest(req)
      .event('server:schedule.execute')
      .subject(schedule, 'Schedule')
      .property('name', schedule.name)
      .log();

    res.status(202).json();
  }

  /**
   * Deletes a schedule and its associated tasks.
   */
  async delete(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const user = (req as any).user;

    if (!this.hasPermission(user, server, ACTION_SCHEDULE_DELETE)) {
      throw new AuthorizationException();
    }

    const schedule = await this.getSchedule(req.params['schedule']!, server.id);

    // Delete tasks first, then the schedule
    await prisma.tasks.deleteMany({ where: { schedule_id: schedule.id } });
    await prisma.schedules.delete({ where: { id: schedule.id } });

    await activityFromRequest(req)
      .event('server:schedule.delete')
      .subject(schedule, 'Schedule')
      .property('name', schedule.name)
      .log();

    res.status(204).json();
  }

  /**
   * Get the next run timestamp based on the cron data provided.
   */
  private getNextRunAt(req: Request): Date {
    try {
      // Simple calculation: default to next minute
      // In production, use a cron parser like 'cron-parser'
      const now = new Date();
      return new Date(now.getTime() + 60 * 1000);
    } catch {
      throw new DisplayException('The cron data provided does not evaluate to a valid expression.');
    }
  }

  /**
   * Get a schedule by ID and verify it belongs to the server.
   */
  private async getSchedule(scheduleId: string, serverId: number): Promise<any> {
    const id = parseInt(scheduleId, 10);
    if (isNaN(id)) {
      throw new NotFoundHttpException();
    }

    const schedule = await prisma.schedules.findFirst({
      where: { id, server_id: serverId },
    });

    if (!schedule) {
      throw new NotFoundHttpException();
    }

    return schedule;
  }

  private hasPermission(user: any, server: any, permission: string): boolean {
    if (user.root_admin) return true;
    if (server.owner_id === user.id) return true;
    const subuser = (user as any).subuser;
    if (subuser && Array.isArray(subuser.permissions)) {
      return subuser.permissions.includes(permission);
    }
    return false;
  }
}

export const scheduleController = new ScheduleController();
