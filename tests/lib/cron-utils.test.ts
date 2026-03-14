import { describe, it, expect } from 'vitest';
import { INTERVAL_PRESETS, getNextRunAt } from '@/lib/cron-utils';

describe('INTERVAL_PRESETS', () => {
  it('has exactly 5 entries', () => {
    expect(INTERVAL_PRESETS).toHaveLength(5);
  });

  it('has the correct labels', () => {
    const labels = INTERVAL_PRESETS.map((p) => p.label);
    expect(labels).toContain('Twice daily');
    expect(labels).toContain('Daily');
    expect(labels).toContain('Every other day');
    expect(labels).toContain('Every 3 days');
    expect(labels).toContain('Weekly');
  });

  it('has correct hours for each preset', () => {
    const byLabel = Object.fromEntries(INTERVAL_PRESETS.map((p) => [p.label, p.hours]));
    expect(byLabel['Twice daily']).toBe(12);
    expect(byLabel['Daily']).toBe(24);
    expect(byLabel['Every other day']).toBe(48);
    expect(byLabel['Every 3 days']).toBe(72);
    expect(byLabel['Weekly']).toBe(168);
  });

  it('each preset cron expression is a non-empty string', () => {
    for (const preset of INTERVAL_PRESETS) {
      expect(typeof preset.cron).toBe('string');
      expect(preset.cron.length).toBeGreaterThan(0);
    }
  });

  it('each preset cron expression validates via node-cron', async () => {
    const nodeCron = await import('node-cron');
    for (const preset of INTERVAL_PRESETS) {
      expect(nodeCron.validate(preset.cron), `Invalid cron for ${preset.label}: ${preset.cron}`).toBe(true);
    }
  });
});

describe('getNextRunAt', () => {
  const from = new Date('2026-03-14T00:00:00.000Z');

  it('returns a Date for the daily preset cron', () => {
    const result = getNextRunAt('0 0 * * *', from);
    expect(result).toBeInstanceOf(Date);
  });

  it('returns a Date in the future relative to "from"', () => {
    const result = getNextRunAt('0 0 * * *', from);
    expect(result).not.toBeNull();
    expect(result!.getTime()).toBeGreaterThan(from.getTime());
  });

  it('returns a Date within 12 hours for the twice-daily cron', () => {
    const result = getNextRunAt('0 */12 * * *', from);
    expect(result).not.toBeNull();
    const diffMs = result!.getTime() - from.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    expect(diffHours).toBeLessThanOrEqual(12);
  });

  it('returns null for an invalid cron expression', () => {
    expect(getNextRunAt('invalid-cron')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(getNextRunAt('')).toBeNull();
  });

  it('uses "from" parameter as the base date', () => {
    const fixedFrom = new Date('2026-01-01T00:00:00.000Z');
    const result = getNextRunAt('0 0 * * *', fixedFrom);
    expect(result).not.toBeNull();
    expect(result!.getTime()).toBeGreaterThan(fixedFrom.getTime());
  });

  it('returns a future Date for each preset cron', () => {
    for (const preset of INTERVAL_PRESETS) {
      const result = getNextRunAt(preset.cron, from);
      expect(result, `Expected Date for preset ${preset.label}`).not.toBeNull();
      expect(result!.getTime()).toBeGreaterThan(from.getTime());
    }
  });
});
