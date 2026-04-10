import { prisma } from '../../prisma/client.js';
import { DaemonRepository } from '../../repositories/wings/daemonRepository.js';
import { InitiateBackupService } from '../../services/backups/initiateBackupService.js';
import { DaemonConnectionException } from '../../errors/index.js';

/**
 * Job that runs a scheduled task by sending the appropriate action to Wings.
 * Mirrors app/Jobs/Schedule/RunTaskJob.php
 */
export async function runTaskJob(task: any, manualRun: boolean = false): Promise<void> {
  // Load task with schedule and server relations if not already loaded
  const fullTask = task.schedules
    ? task
    : await prisma.tasks.findUnique({
        where: { id: task.id },
        include: {
          schedules: {
            include: {
              servers: {
                include: { nodes: true },
              },
            },
          },
        },
      });

  if (!fullTask) {
    return;
  }

  const schedule = fullTask.schedules;
  const server = schedule.servers;

  // Do not process a task that is not set to active, unless manually triggered
  if (!schedule.is_active && !manualRun) {
    await markTaskNotQueued(fullTask);
    await markScheduleComplete(fullTask);
    return;
  }

  // If the server status is not null (suspended, reinstalling, etc.), stop
  if (server.status !== null) {
    await failed(fullTask);
    return;
  }

  // Perform the task action against the daemon
  try {
    switch (fullTask.action) {
      case 'power': {
        const repo = new DaemonRepository();
        repo.setNode(server.nodes);
        await (repo as any).post(
          `/api/servers/${server.uuid}/power`,
          { action: fullTask.payload }
        );
        break;
      }

      case 'command': {
        const repo = new DaemonRepository();
        repo.setNode(server.nodes);
        await (repo as any).post(
          `/api/servers/${server.uuid}/commands`,
          { commands: [fullTask.payload] }
        );
        break;
      }

      case 'backup': {
        const backupService = new InitiateBackupService();
        const ignoredFiles = fullTask.payload
          ? fullTask.payload.split('\n')
          : [];
        backupService.setIgnoredFiles(ignoredFiles);
        await backupService.handle(server, null, true);
        break;
      }

      default:
        throw new Error(`Invalid task action provided: ${fullTask.action}`);
    }
  } catch (error: any) {
    // If this is not a DaemonConnectionException on a task that allows failures, rethrow
    if (!(fullTask.continue_on_failure && error instanceof DaemonConnectionException)) {
      await failed(fullTask);
      throw error;
    }
  }

  await markTaskNotQueued(fullTask);
  await queueNextTask(fullTask, manualRun);
}

/**
 * Handle a failure while sending the action to the daemon.
 */
async function failed(task: any): Promise<void> {
  await markTaskNotQueued(task);
  await markScheduleComplete(task);
}

/**
 * Get the next task in the schedule and queue it.
 */
async function queueNextTask(task: any, manualRun: boolean): Promise<void> {
  const nextTask = await prisma.tasks.findFirst({
    where: {
      schedule_id: task.schedule_id,
      sequence_id: { gt: task.sequence_id },
    },
    orderBy: { sequence_id: 'asc' },
    include: {
      schedules: {
        include: {
          servers: {
            include: { nodes: true },
          },
        },
      },
    },
  });

  if (!nextTask) {
    await markScheduleComplete(task);
    return;
  }

  await prisma.tasks.update({
    where: { id: nextTask.id },
    data: { is_queued: 1 },
  });

  // Execute with delay based on time_offset
  const delayMs = (nextTask.time_offset ?? 0) * 1000;
  if (delayMs > 0) {
    setTimeout(() => {
      runTaskJob(nextTask, manualRun).catch(() => {
        failed(nextTask);
      });
    }, delayMs);
  } else {
    await runTaskJob(nextTask, manualRun);
  }
}

/**
 * Marks the parent schedule as being complete.
 */
async function markScheduleComplete(task: any): Promise<void> {
  await prisma.schedules.update({
    where: { id: task.schedule_id },
    data: {
      is_processing: false,
      last_run_at: new Date(),
    },
  });
}

/**
 * Mark a specific task as no longer being queued.
 */
async function markTaskNotQueued(task: any): Promise<void> {
  await prisma.tasks.update({
    where: { id: task.id },
    data: { is_queued: 0 },
  });
}
