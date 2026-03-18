import { validate } from 'node-cron';
import { computeNextRun } from './cron-presets';

// Re-export client-safe presets for server code that imports from here
export { INTERVAL_PRESETS, buildCronExpression, identifyPreset, parseScheduleTime, computeNextRun } from './cron-presets';
export type { IntervalPreset } from './cron-presets';

/**
 * Given a cron expression and a base date, return the next Date the expression
 * fires after `from`. Validates the expression with node-cron, then computes
 * the next run using our preset-aware parser.
 */
export function getNextRunAt(cronExpression: string, from: Date = new Date()): Date | null {
  if (!cronExpression || !validate(cronExpression)) {
    return null;
  }
  return computeNextRun(cronExpression, from);
}
