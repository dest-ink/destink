import { createRequire } from 'module';
import path from 'path';
import { validate } from 'node-cron';

// TimeMatcher is an internal node-cron class not exposed via its exports map.
// We load it by deriving its path from node-cron's main entry (which is exported),
// wrapped in try/catch so any future version bump gracefully returns null.
const _require = createRequire(import.meta.url);

type TimeMatcherConstructor = new (pattern: string, timezone?: string) => { getNextMatch(date: Date): Date };
let TimeMatcher: TimeMatcherConstructor | null = null;

try {
  const nodeCronMain = _require.resolve('node-cron');
  const distCjsDir = path.dirname(nodeCronMain);
  const timeMatcherPath = path.join(distCjsDir, 'time', 'time-matcher.js');
  const mod = _require(timeMatcherPath);
  TimeMatcher = (mod.TimeMatcher ?? null) as TimeMatcherConstructor | null;
} catch {
  // If the internal path ever moves, getNextRunAt will return null for all expressions
  TimeMatcher = null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IntervalPreset {
  label: string;
  hours: number;
  cron: string;
}

// ─── Presets ─────────────────────────────────────────────────────────────────

export const INTERVAL_PRESETS: IntervalPreset[] = [
  { label: 'Twice daily',    hours: 12,  cron: '0 */12 * * *' },
  { label: 'Daily',          hours: 24,  cron: '0 0 * * *'    },
  { label: 'Every other day',hours: 48,  cron: '0 0 */2 * *'  },
  { label: 'Every 3 days',   hours: 72,  cron: '0 0 */3 * *'  },
  { label: 'Weekly',         hours: 168, cron: '0 0 * * 0'    },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Given a cron expression and a base date, return the next Date the expression
 * fires after `from`. Returns null if the expression is invalid or if the
 * TimeMatcher internal module is unavailable.
 */
export function getNextRunAt(cronExpression: string, from: Date = new Date()): Date | null {
  if (!cronExpression || !validate(cronExpression)) {
    return null;
  }
  if (!TimeMatcher) {
    return null;
  }
  try {
    // Pass undefined (NOT null) as timezone — passing null causes a RangeError
    // in the Intl.DateTimeFormat constructor inside node-cron.
    const matcher = new TimeMatcher(cronExpression, undefined);
    return matcher.getNextMatch(from);
  } catch {
    return null;
  }
}
