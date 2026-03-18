// Client-safe cron preset constants and utilities — no Node.js dependencies

export interface IntervalPreset {
  label: string;
  hours: number;
  cron: string; // default cron (midnight)
}

export const INTERVAL_PRESETS: IntervalPreset[] = [
  { label: 'Twice daily',     hours: 12,  cron: '0 */12 * * *' },
  { label: 'Daily',           hours: 24,  cron: '0 0 * * *'    },
  { label: 'Every other day', hours: 48,  cron: '0 0 */2 * *'  },
  { label: 'Every 3 days',    hours: 72,  cron: '0 0 */3 * *'  },
  { label: 'Weekly',          hours: 168, cron: '0 0 * * 0'    },
];

/**
 * Build a cron expression from a preset interval and a specific time of day.
 */
export function buildCronExpression(presetHours: number, hour: number, minute: number): string {
  const m = minute;
  const h = hour;
  switch (presetHours) {
    case 12:  return `${m} ${h},${(h + 12) % 24} * * *`;  // twice daily
    case 24:  return `${m} ${h} * * *`;                     // daily
    case 48:  return `${m} ${h} */2 * *`;                   // every other day
    case 72:  return `${m} ${h} */3 * *`;                   // every 3 days
    case 168: return `${m} ${h} * * 0`;                     // weekly
    default:  return `${m} ${h} * * *`;
  }
}

/**
 * Identify which preset a cron expression belongs to.
 */
export function identifyPreset(cronExpression: string): IntervalPreset | null {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [, hourField, domField, , dowField] = parts;

  if (hourField.includes(',')) return INTERVAL_PRESETS[0]; // twice daily
  if (dowField !== '*')        return INTERVAL_PRESETS[4]; // weekly
  if (domField === '*/3')      return INTERVAL_PRESETS[3]; // every 3 days
  if (domField === '*/2')      return INTERVAL_PRESETS[2]; // every other day
  if (domField === '*')        return INTERVAL_PRESETS[1]; // daily
  return null;
}

/**
 * Extract the scheduled time-of-day from a cron expression.
 */
export function parseScheduleTime(cronExpression: string): { hour: number; minute: number } | null {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const minute = parseInt(parts[0]);
  const hours = parts[1].split(',').map(Number);
  if (isNaN(minute) || hours.some(isNaN)) return null;
  return { hour: Math.min(...hours), minute };
}

/**
 * Compute the next run date from a cron expression.
 * Works client-side — no Node.js dependencies.
 * Handles the preset patterns we generate (not a full cron parser).
 */
export function computeNextRun(cronExpression: string, from: Date = new Date()): Date | null {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minField, hourField, domField, , dowField] = parts;
  const minute = parseInt(minField);
  if (isNaN(minute) || minute < 0 || minute > 59) return null;

  const hours = hourField.split(',').map(Number);
  if (hours.some(h => isNaN(h) || h < 0 || h > 23)) return null;
  hours.sort((a, b) => a - b);

  for (let dayOffset = 0; dayOffset <= 10; dayOffset++) {
    const day = new Date(from);
    day.setDate(day.getDate() + dayOffset);

    // Check day-of-week constraint
    if (dowField !== '*') {
      const targetDow = parseInt(dowField);
      if (!isNaN(targetDow) && day.getDay() !== targetDow) continue;
    }

    // Check day-of-month interval constraint
    if (domField.startsWith('*/')) {
      const interval = parseInt(domField.slice(2));
      if (!isNaN(interval) && interval > 1) {
        if ((day.getDate() - 1) % interval !== 0) continue;
      }
    }

    for (const hour of hours) {
      const candidate = new Date(day);
      candidate.setHours(hour, minute, 0, 0);
      if (candidate > from) return candidate;
    }
  }

  return null;
}

/**
 * Format a time for display (e.g. "9:00 AM").
 */
export function formatTime(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
