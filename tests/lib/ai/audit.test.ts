import { describe, it, expect } from 'vitest';
import { computeCost } from '@/lib/ai/audit';

describe('computeCost', () => {
  it('calculates cost for claude-sonnet-4-6', () => {
    // $3/MTok input, $15/MTok output
    const cost = computeCost('claude-sonnet-4-6', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(18, 2); // $3 + $15
  });

  it('calculates cost for claude-haiku-4-5-20251001', () => {
    // $0.80/MTok input, $4/MTok output
    const cost = computeCost('claude-haiku-4-5-20251001', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(4.8, 2); // $0.80 + $4
  });

  it('returns 0 for unknown model', () => {
    const cost = computeCost('unknown-model', 1000, 1000);
    expect(cost).toBe(0);
  });
});
