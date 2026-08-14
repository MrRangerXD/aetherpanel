import { getDb, saveDbSync } from './db';
import { createRealBackupProcess, pruneExpiredBackups } from './backups';
import { startServer, stopServer, restartServer, sendServerConsoleInput, appendConsoleLog, recordServerActivity } from './provider';
import { ServerSchedule } from '../src/types';

export function calculateNextRunAt(schedule: ServerSchedule): string {
  const now = new Date();

  if (schedule.scheduleType === 'one-time') {
    if (schedule.date && schedule.time) {
      const target = new Date(`${schedule.date}T${schedule.time}:00`);
      if (target.getTime() > now.getTime()) {
        return target.toISOString();
      }
    }
    // Default to +1 hour if invalid past date
    return new Date(now.getTime() + 3600000).toISOString();
  }

  if (schedule.scheduleType === 'hourly') {
    const hours = Math.max(1, schedule.intervalHours || 1);
    return new Date(now.getTime() + hours * 3600000).toISOString();
  }

  if (schedule.scheduleType === 'daily') {
    const [targetH, targetM] = (schedule.time || '04:00').split(':').map(Number);
    const target = new Date(now);
    target.setHours(targetH || 4, targetM || 0, 0, 0);

    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    return target.toISOString();
  }

  if (schedule.scheduleType === 'weekly') {
    const targetDay = schedule.dayOfWeek ?? 1; // 0=Sunday, 1=Monday...
    const [targetH, targetM] = (schedule.time || '04:00').split(':').map(Number);
    const target = new Date(now);
    target.setHours(targetH || 4, targetM || 0, 0, 0);

    let daysToAdd = (targetDay - now.getDay() + 7) % 7;
    if (daysToAdd === 0 && target.getTime() <= now.getTime()) {
      daysToAdd = 7;
    }
    target.setDate(target.getDate() + daysToAdd);
    return target.toISOString();
  }

  // custom_cron default (or standard 5-part cron estimation)
  // e.g. "0 */6 * * *" => every 6 hours
  return new Date(now.getTime() + 3600000 * 6).toISOString();
}

export async function processScheduledTasks(): Promise<void> {
  const db = await getDb();
  const activeSchedules = db.schedules.filter(s => s.isEnabled);
  const nowTime = Date.now();

  for (const sched of activeSchedules) {
    if (!sched.nextRunAt) {
      sched.nextRunAt = calculateNextRunAt(sched);
      saveDbSync();
      continue;
    }

    const nextRunTime = new Date(sched.nextRunAt).getTime();
    if (nowTime >= nextRunTime) {
      const server = db.servers.find(s => s.id === sched.serverId);
      if (!server) {
        sched.isEnabled = false;
        sched.lastError = 'Server no longer exists';
        saveDbSync();
        continue;
      }

      appendConsoleLog(sched.serverId, `[ScheduleEngine]: Executing scheduled task '${sched.name}' (Action: ${sched.action.toUpperCase()})...`);

      try {
        if (sched.action === 'backup') {
          await createRealBackupProcess(
            sched.serverId,
            `Scheduled_${sched.name.replace(/\s+/g, '_')}`,
            'scheduled'
          );
        } else if (sched.action === 'start') {
          await startServer(sched.serverId);
        } else if (sched.action === 'stop') {
          await stopServer(sched.serverId);
        } else if (sched.action === 'restart') {
          await restartServer(sched.serverId);
        } else if (sched.action === 'command' && sched.payload) {
          sendServerConsoleInput(sched.serverId, sched.payload);
        }

        sched.lastRunAt = new Date().toISOString();
        sched.lastStatus = 'success';
        sched.lastError = undefined;

        await recordServerActivity(sched.serverId, server.userId, 'ScheduleEngine', 'SCHEDULE_EXECUTE', `Executed task '${sched.name}'`);

      } catch (err: any) {
        console.error(`Scheduled task ${sched.id} failed:`, err);
        sched.lastRunAt = new Date().toISOString();
        sched.lastStatus = 'failed';
        sched.lastError = err.message || 'Execution error';
        appendConsoleLog(sched.serverId, `[ScheduleEngine/ERROR]: Task execution failed: ${err.message}`);
      } finally {
        if (sched.scheduleType === 'one-time') {
          sched.isEnabled = false;
        } else {
          sched.nextRunAt = calculateNextRunAt(sched);
        }
        saveDbSync();
      }
    }
  }
}

let schedulerTimer: NodeJS.Timeout | null = null;

export function startSchedulerLoop(): void {
  if (schedulerTimer) return;

  console.log('Starting AetherPanel Schedule & Backup Automation Engine (30s interval)');

  schedulerTimer = setInterval(async () => {
    try {
      await processScheduledTasks();
      await pruneExpiredBackups();
    } catch (err) {
      console.error('Error in schedule loop:', err);
    }
  }, 30000); // Check every 30 seconds
}
