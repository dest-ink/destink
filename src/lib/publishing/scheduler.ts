import type { ScheduleConfig } from '@/db/schema';

// Default configs used if channel scheduleConfig is null
const DEFAULT_WINDOWS: Record<string, ScheduleConfig> = {
  linkedin: {
    timezone: 'America/New_York',
    minGapHours: 18,
    jitterMinutes: 30,
    timeWindows: [
      { dayOfWeek: [2, 3, 4], startHour: 8, endHour: 10 },
      { dayOfWeek: [2, 3, 4], startHour: 12, endHour: 13 },
    ],
  },
  substack: {
    timezone: 'America/New_York',
    minGapHours: 24,
    jitterMinutes: 20,
    timeWindows: [
      { dayOfWeek: [2, 4], startHour: 7, endHour: 9 },
    ],
  },
};

export function applyJitter(base: Date, jitterMinutes: number): Date {
  const offsetMs = (Math.random() * 2 - 1) * jitterMinutes * 60 * 1000;
  return new Date(base.getTime() + offsetMs);
}

export function assignScheduledTime(
  platform: string,
  config: ScheduleConfig | null
): Date {
  const cfg = config ?? DEFAULT_WINDOWS[platform] ?? DEFAULT_WINDOWS.linkedin;
  const now = new Date();

  // Find next valid window
  for (let daysAhead = 0; daysAhead < 14; daysAhead++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + daysAhead);
    const dow = candidate.getDay();

    for (const window of cfg.timeWindows) {
      if (!window.dayOfWeek.includes(dow)) continue;

      // Pick midpoint of window
      const midHour = (window.startHour + window.endHour) / 2;
      candidate.setHours(Math.floor(midHour), 0, 0, 0);

      // Must be in the future
      if (candidate.getTime() <= now.getTime()) continue;

      return applyJitter(candidate, cfg.jitterMinutes);
    }
  }

  // Fallback: 24 hours from now
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}
