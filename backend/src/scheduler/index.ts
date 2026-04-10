import cron from 'node-cron';
import { prisma } from '../prisma/client.js';
import { ProcessScheduleService } from '../services/schedules/processScheduleService.js';
import { config } from '../config/index.js';

/**
 * Application task scheduler.
 * Replaces Laravel's Console Kernel scheduled tasks.
 *
 * Schedules:
 * - Every minute: Process runnable server schedules
 * - Every 30 minutes: Prune orphaned backups (if configured)
 * - Daily: Prune old activity logs (if configured)
 * - Hourly: Clean stale cache tags (no-op in this implementation)
 */

let started = false;

export function startScheduler(): void {
  if (started) return;
  started = true;

  console.log('[Scheduler] Starting task scheduler...');

  // Every minute: Process runnable schedules
  cron.schedule('* * * * *', async () => {
    try {
      await processRunnableSchedules();
    } catch (err) {
      console.error('[Scheduler] Error processing schedules:', err);
    }
  });

  // Every 30 minutes: Prune orphaned backups
  cron.schedule('*/30 * * * *', async () => {
    try {
      await pruneOrphanedBackups();
    } catch (err) {
      console.error('[Scheduler] Error pruning backups:', err);
    }
  });

  // Daily at 00:00: Prune old activity logs
  cron.schedule('0 0 * * *', async () => {
    try {
      await pruneActivityLogs();
    } catch (err) {
      console.error('[Scheduler] Error pruning activity logs:', err);
    }
  });

  console.log('[Scheduler] Task scheduler started.');
}

/**
 * Find and process all schedules that are due to run.
 * Mirrors app/Console/Commands/Schedule/ProcessRunnableCommand.php
 */
async function processRunnableSchedules(): Promise<void> {
  const now = new Date();

  const dueSchedules = await prisma.schedules.findMany({
    where: {
      is_active: true,
      is_processing: false,
      next_run_at: {
        lte: now,
      },
    },
    include: {
      tasks: {
        orderBy: { sequence_id: 'asc' },
      },
      servers: true,
    },
  });

  if (dueSchedules.length === 0) return;

  console.log(`[Scheduler] Processing ${dueSchedules.length} runnable schedule(s)...`);

  for (const schedule of dueSchedules) {
    try {
      // Skip if server is suspended or being installed
      if (schedule.servers?.status === 'suspended') continue;
      if (schedule.servers?.status === 'installing') continue;

      // Skip if only_when_online and server might be offline
      // (In a full implementation, we'd check the daemon for server status)

      const service = new ProcessScheduleService();
      await service.handle(schedule, false);
    } catch (err) {
      console.error(`[Scheduler] Failed to process schedule ${schedule.id}:`, err);

      // Mark as not processing so it can retry next minute
      await prisma.schedules.update({
        where: { id: schedule.id },
        data: { is_processing: false },
      });
    }
  }
}

/**
 * Prune orphaned backups older than the configured age.
 * Mirrors app/Console/Commands/Maintenance/PruneOrphanedBackupsCommand.php
 */
async function pruneOrphanedBackups(): Promise<void> {
  const pruneAge = parseInt(process.env['BACKUP_PRUNE_AGE'] ?? '0', 10);
  if (pruneAge <= 0) return;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - pruneAge);

  // Find backups that are not completed and older than the prune age
  const orphaned = await prisma.backups.findMany({
    where: {
      is_successful: false,
      created_at: {
        lt: cutoff,
      },
      completed_at: null,
    },
  });

  if (orphaned.length === 0) return;

  console.log(`[Scheduler] Pruning ${orphaned.length} orphaned backup(s)...`);

  for (const backup of orphaned) {
    try {
      await prisma.backups.delete({
        where: { id: backup.id },
      });
    } catch (err) {
      console.error(`[Scheduler] Failed to prune backup ${backup.uuid}:`, err);
    }
  }
}

/**
 * Prune old activity logs.
 * Mirrors Laravel's model:prune command for ActivityLog.
 */
async function pruneActivityLogs(): Promise<void> {
  const pruneDays = parseInt(process.env['ACTIVITY_PRUNE_DAYS'] ?? '0', 10);
  if (pruneDays <= 0) return;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - pruneDays);

  const result = await prisma.activity_logs.deleteMany({
    where: {
      timestamp: {
        lt: cutoff,
      },
    },
  });

  if (result.count > 0) {
    console.log(`[Scheduler] Pruned ${result.count} old activity log(s).`);
  }
}
