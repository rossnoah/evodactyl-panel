import { Request, Response } from 'express';
import { prisma } from '../../../../prisma/client.js';
import { fractal } from '../../../../serializers/fractal.js';
import { TaskTransformer } from '../../../../transformers/client/taskTransformer.js';
import { activityFromRequest } from '../../../../services/activity/activityLogService.js';
import { config } from '../../../../config/index.js';
import {
  AuthorizationException,
  NotFoundHttpException,
  HttpForbiddenException,
  DisplayException,
} from '../../../../errors/index.js';
import {
  ACTION_SCHEDULE_UPDATE,
} from '../../../../permissions.js';

/**
 * Schedule task controller for the client API.
 * Mirrors app/Http/Controllers/Api/Client/Servers/ScheduleTaskController.php
 */
export class ScheduleTaskController {
  /**
   * Create a new task for a given schedule.
   */
  async store(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const user = (req as any).user;

    if (!this.hasPermission(user, server, ACTION_SCHEDULE_UPDATE)) {
      throw new AuthorizationException();
    }

    const schedule = await this.getSchedule(req.params['schedule']!, server.id);

    const limit = config.pterodactyl.clientFeatures.schedules.perScheduleTaskLimit;
    const taskCount = await prisma.tasks.count({ where: { schedule_id: schedule.id } });

    if (taskCount >= limit) {
      throw new DisplayException(
        `Schedules may not have more than ${limit} tasks associated with them. Creating this task would put this schedule over the limit.`,
        400
      );
    }

    if (server.backup_limit === 0 && req.body.action === 'backup') {
      throw new HttpForbiddenException(
        "A backup task cannot be created when the server's backup limit is set to 0."
      );
    }

    // Get the last task's sequence_id
    const lastTask = await prisma.tasks.findFirst({
      where: { schedule_id: schedule.id },
      orderBy: { sequence_id: 'desc' },
    });

    const nextSequenceId = (lastTask?.sequence_id ?? 0) + 1;
    let sequenceId = parseInt(req.body.sequence_id, 10) || nextSequenceId;

    if (sequenceId < 1) {
      sequenceId = 1;
    }

    // If the requested sequence_id is less than the next available, shift existing tasks
    if (sequenceId < nextSequenceId) {
      await prisma.tasks.updateMany({
        where: {
          schedule_id: schedule.id,
          sequence_id: { gte: sequenceId },
        },
        data: { sequence_id: { increment: 1 } },
      });
    } else {
      sequenceId = nextSequenceId;
    }

    const task = await prisma.tasks.create({
      data: {
        schedule_id: schedule.id,
        sequence_id: sequenceId,
        action: req.body.action,
        payload: req.body.payload ?? '',
        time_offset: parseInt(req.body.time_offset, 10) || 0,
        continue_on_failure: req.body.continue_on_failure ? 1 : 0,
      },
    });

    await activityFromRequest(req)
      .event('server:task.create')
      .subject(schedule, 'Schedule')
      .property({ name: schedule.name, action: task.action, payload: task.payload })
      .log();

    const transformer = new TaskTransformer();
    transformer.setRequest(req);

    const response = await fractal(req)
      .item(task)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  }

  /**
   * Updates a given task for a server.
   */
  async update(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const user = (req as any).user;

    if (!this.hasPermission(user, server, ACTION_SCHEDULE_UPDATE)) {
      throw new AuthorizationException();
    }

    const schedule = await this.getSchedule(req.params['schedule']!, server.id);
    const task = await this.getTask(req.params['task']!, schedule.id);

    if (server.backup_limit === 0 && req.body.action === 'backup') {
      throw new HttpForbiddenException(
        "A backup task cannot be created when the server's backup limit is set to 0."
      );
    }

    let sequenceId = parseInt(req.body.sequence_id, 10) || task.sequence_id;
    if (sequenceId < 1) {
      sequenceId = 1;
    }

    // Shift tasks if sequence_id changed
    if (sequenceId < task.sequence_id) {
      await prisma.tasks.updateMany({
        where: {
          schedule_id: schedule.id,
          sequence_id: { gte: sequenceId, lt: task.sequence_id },
        },
        data: { sequence_id: { increment: 1 } },
      });
    } else if (sequenceId > task.sequence_id) {
      await prisma.tasks.updateMany({
        where: {
          schedule_id: schedule.id,
          sequence_id: { gt: task.sequence_id, lte: sequenceId },
        },
        data: { sequence_id: { decrement: 1 } },
      });
    }

    const updated = await prisma.tasks.update({
      where: { id: task.id },
      data: {
        sequence_id: sequenceId,
        action: req.body.action,
        payload: req.body.payload ?? '',
        time_offset: parseInt(req.body.time_offset, 10) || 0,
        continue_on_failure: req.body.continue_on_failure ? 1 : 0,
      },
    });

    await activityFromRequest(req)
      .event('server:task.update')
      .subject(schedule, 'Schedule')
      .property({ name: schedule.name, action: updated.action, payload: updated.payload })
      .log();

    const transformer = new TaskTransformer();
    transformer.setRequest(req);

    const response = await fractal(req)
      .item(updated)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  }

  /**
   * Delete a given task for a schedule.
   */
  async delete(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const user = (req as any).user;

    if (!this.hasPermission(user, server, ACTION_SCHEDULE_UPDATE)) {
      throw new AuthorizationException();
    }

    const schedule = await this.getSchedule(req.params['schedule']!, server.id);
    const task = await this.getTask(req.params['task']!, schedule.id);

    // Decrement sequence_id of tasks after this one
    await prisma.tasks.updateMany({
      where: {
        schedule_id: schedule.id,
        sequence_id: { gt: task.sequence_id },
      },
      data: { sequence_id: { decrement: 1 } },
    });

    await prisma.tasks.delete({ where: { id: task.id } });

    await activityFromRequest(req)
      .event('server:task.delete')
      .subject(schedule, 'Schedule')
      .property('name', schedule.name)
      .log();

    res.status(204).json();
  }

  private async getSchedule(scheduleId: string, serverId: number): Promise<any> {
    const id = parseInt(scheduleId, 10);
    if (isNaN(id)) throw new NotFoundHttpException();

    const schedule = await prisma.schedules.findFirst({
      where: { id, server_id: serverId },
    });

    if (!schedule) throw new NotFoundHttpException();
    return schedule;
  }

  private async getTask(taskId: string, scheduleId: number): Promise<any> {
    const id = parseInt(taskId, 10);
    if (isNaN(id)) throw new NotFoundHttpException();

    const task = await prisma.tasks.findFirst({
      where: { id, schedule_id: scheduleId },
    });

    if (!task) throw new NotFoundHttpException();
    return task;
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

export const scheduleTaskController = new ScheduleTaskController();
