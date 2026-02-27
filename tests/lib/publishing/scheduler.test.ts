import { describe, it, expect } from 'vitest';
import { assignScheduledTime, applyJitter } from '@/lib/publishing/scheduler';
import type { ScheduleConfig } from '@/db/schema';

const linkedinConfig: ScheduleConfig = {
  timezone: 'America/New_York',
  minGapHours: 18,
  jitterMinutes: 30,
  timeWindows: [{ dayOfWeek: [2, 3, 4], startHour: 8, endHour: 10 }],
};

describe('applyJitter', () => {
  it('adds random offset within jitter range', () => {
    const base = new Date('2026-03-10T08:00:00Z');
    const jittered = applyJitter(base, 30);
    const diffMin = (jittered.getTime() - base.getTime()) / 60000;
    expect(diffMin).toBeGreaterThanOrEqual(-30);
    expect(diffMin).toBeLessThan(30); // range is [-30, 30) — upper bound is exclusive
  });

  it('returns the exact base date when jitterMinutes is 0', () => {
    const base = new Date('2026-03-10T08:00:00Z');
    const result = applyJitter(base, 0);
    expect(result.getTime()).toBe(base.getTime());
  });
});

describe('assignScheduledTime', () => {
  it('returns a date in the future', () => {
    const scheduled = assignScheduledTime('linkedin', linkedinConfig);
    expect(scheduled.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns a date in the future when config is null (uses defaults)', () => {
    const scheduled = assignScheduledTime('linkedin', null);
    expect(scheduled.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns a date in the future for substack with null config', () => {
    const scheduled = assignScheduledTime('substack', null);
    expect(scheduled.getTime()).toBeGreaterThan(Date.now());
  });

  it('falls back to 24h from now for unknown platform with null config', () => {
    const before = Date.now();
    const scheduled = assignScheduledTime('unknown-platform', null);
    const after = Date.now();
    expect(scheduled.getTime()).toBeGreaterThan(before);
    expect(scheduled.getTime()).toBeLessThanOrEqual(after + 25 * 60 * 60 * 1000);
  });

  it('falls back to 24h from now when no windows match (empty timeWindows)', () => {
    const noWindows: ScheduleConfig = {
      timezone: 'America/New_York',
      minGapHours: 18,
      jitterMinutes: 0,
      timeWindows: [],
    };
    const before = Date.now();
    const scheduled = assignScheduledTime('linkedin', noWindows);
    const after = Date.now();
    // Should be approximately 24h from now (no jitter since jitterMinutes=0)
    expect(scheduled.getTime()).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000);
    expect(scheduled.getTime()).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000 + 1000);
  });
});
