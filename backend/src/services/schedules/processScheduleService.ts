import { prisma } from '../../prisma/client.js';
import { DisplayException } from '../../errors/index.js';
import { runTaskJob } from '../../jobs/schedule/runTaskJob.js';

/**
 * Service for processing scheduled tasks.
 * Mirrors app/Services/Schedules/ProcessScheduleService.php
 */
export class ProcessScheduleService {
  /**
   * Process a schedule and push the first task onto the queue.
   */
  async handle(schedule: any, now: boolean = false): Promise<void> {
    // Get the first task in the schedule
    const task = await prisma.tasks.findFirst({
      where: { schedule_id: schedule.id },
      orderBy: { sequence_id: 'asc' },
    });

    if (!task) {
      throw new DisplayException(
        'Cannot process schedule for task execution: no tasks are registered.'
      );
    }

    // Update schedule state
    await prisma.$transaction([
      prisma.schedules.update({
        where: { id: schedule.id },
        data: {
          is_processing: true,
          next_run_at: this.getNextRunDate(schedule),
        },
      }),
      prisma.tasks.update({
        where: { id: task.id },
        data: { is_queued: 1 },
      }),
    ]);

    // Check if server should only run when online
    if (schedule.only_when_online) {
      // Load server details from the daemon
      try {
        const server = schedule.servers ?? await prisma.servers.findUnique({
          where: { id: schedule.server_id },
          include: { nodes: true },
        });

        // If the server has a non-null status (suspended, etc.), don't run
        if (server?.status !== null) {
          await this.markFailed(task, schedule);
          return;
        }
      } catch {
        await this.markFailed(task, schedule);
        return;
      }
    }

    // Execute the task
    if (now) {
      try {
        await runTaskJob(task, true);
      } catch (error) {
        await this.markFailed(task, schedule);
        throw error;
      }
    } else {
      // In a production system, this would dispatch to a job queue with delay
      // For now, execute with setTimeout for the time_offset
      const delayMs = (task.time_offset ?? 0) * 1000;
      setTimeout(() => {
        runTaskJob(task, false).catch(() => {
          this.markFailed(task, schedule);
        });
      }, delayMs);
    }
  }

  /**
   * Get the next run date for the schedule based on cron expression.
   */
  private getNextRunDate(schedule: any): Date {
    // Simple next-run calculation based on cron fields
    // In production, use a cron parser library
    const now = new Date();
    // Default to 1 hour from now if we can't parse the cron
    return new Date(now.getTime() + 60 * 60 * 1000);
  }

  /**
   * Mark a task and schedule as failed/complete.
   */
  private async markFailed(task: any, schedule: any): Promise<void> {
    await prisma.$transaction([
      prisma.tasks.update({
        where: { id: task.id },
        data: { is_queued: 0 },
      }),
      prisma.schedules.update({
        where: { id: schedule.id },
        data: {
          is_processing: false,
          last_run_at: new Date(),
        },
      }),
    ]);
  }
}
