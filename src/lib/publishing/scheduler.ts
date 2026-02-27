import type { ScheduleConfig } from '@/db/schema';

// Default configs used if channel scheduleConfig is null.
// Unknown platforms fall back to the linkedin default.
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

  // Find next valid window across the next 14 days.
  // TODO: window hours are currently resolved in server local time, not cfg.timezone.
  //       Add IANA timezone arithmetic (via Intl or a date library) before production use.
  for (let daysAhead = 0; daysAhead < 14; daysAhead++) {
    // candidateBase is never mutated so that multiple windows on the same day
    // each get a clean starting point for setHours.
    const candidateBase = new Date(now);
    candidateBase.setDate(candidateBase.getDate() + daysAhead);
    const dow = candidateBase.getDay();

    for (const window of cfg.timeWindows) {
      if (!window.dayOfWeek.includes(dow)) continue;

      // Pick midpoint of window, preserving sub-hour precision (e.g. 12:30 for {12,13}).
      const midHour = (window.startHour + window.endHour) / 2;
      const midMinute = Math.round((midHour % 1) * 60);
      const candidate = new Date(candidateBase);
      candidate.setHours(Math.floor(midHour), midMinute, 0, 0);

      // Must be in the future
      if (candidate.getTime() <= now.getTime()) continue;

      return applyJitter(candidate, cfg.jitterMinutes);
    }
  }

  // Fallback: 24 hours from now
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}
