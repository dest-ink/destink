import { describe, it, expect } from 'vitest';
import { getRetryDelay } from '@/daemon/index';

describe('getRetryDelay', () => {
  it('returns 5min for first retry', () => {
    expect(getRetryDelay(1)).toBe(5 * 60 * 1000);
  });
  it('returns 15min for second retry', () => {
    expect(getRetryDelay(2)).toBe(15 * 60 * 1000);
  });
  it('returns 45min for third retry', () => {
    expect(getRetryDelay(3)).toBe(45 * 60 * 1000);
  });
  it('caps at 45min for retries beyond 3', () => {
    expect(getRetryDelay(4)).toBe(45 * 60 * 1000);
    expect(getRetryDelay(10)).toBe(45 * 60 * 1000);
  });
});
