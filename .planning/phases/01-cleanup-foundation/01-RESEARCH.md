# Phase 1: Cleanup & Foundation - Research

**Researched:** 2026-02-27
**Domain:** Node.js process lifecycle, pg connection pooling, node-cron graceful shutdown, Drizzle ORM query patterns, Vitest unit testing
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Stuck item recovery (CLEAN-02):**
- Detection: Time-based threshold — if a queue item has been in `publishing` status for longer than 15 minutes, consider it stuck
- Recovery action: Reset status back to `pending` so it gets retried on the next daemon cycle
- No retry limit tracking — items reset to pending indefinitely (simple approach)
- Visibility: Console log a warning when items are recovered — no DB record of recovery events
- Recovery runs on each daemon cycle (check for stuck items at the start of each queue processing loop)

**Daily summary content (CLEAN-05):**
- Content: Counts only — research completed, drafts generated, items published, items failed
- Granularity: Just totals, not per-channel breakdown
- Time window: Last 24 hours
- Output: Console/stdout — captured by container logs in Docker environments
- Format: Simple log lines, not structured JSON (matches existing job output patterns)

### Claude's Discretion
- Graceful shutdown implementation details (signal handling, timeout duration, cleanup order)
- Test coverage depth and structure for queue runner tests
- How `process.exit(0)` replacement is implemented (pool.end() in finally blocks)
- Daily summary query optimization
- Concurrency policy documentation format (CLEAN-04)

### Deferred Ideas (OUT OF SCOPE)
- Activity feed / log page — a filterable UI showing logs and activity across the system. Could pair with Phase 3 UI work or be its own phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLEAN-01 | Job scripts close DB connection pool before process.exit (pg Pool leak fix) | See "Pool Lifecycle" pattern: `pool.end()` is async, must be awaited in `finally` block before any `process.exit` call |
| CLEAN-02 | Stuck queue items in `publishing` status are recovered on daemon restart | See "Stuck Item Detection" pattern: `publishQueue` has no `updatedAt` — detection must use `createdAt` as a proxy; schema migration required to add `processingStartedAt` OR accept `createdAt`-based heuristic |
| CLEAN-03 | Daemon handles SIGTERM for graceful shutdown in containerized environments | See "SIGTERM Pattern": `process.on('SIGTERM', async () => { task.stop(); await tick(); await pool.end(); process.exit(0); })` — node-cron 4.x supports `task.stop()` and `task.destroy()` |
| CLEAN-04 | Publish job documents `concurrencyPolicy: Forbid` requirement | Comment/docstring in `src/jobs/publish.ts` or `src/daemon/index.ts` explaining the requirement — no code change needed |
| CLEAN-05 | Daily summary job implemented (`src/jobs/daily-summary.ts` + npm script) | See "Daily Summary Queries" pattern: 4 Drizzle queries using `gte(createdAt, cutoff)` on `researchRuns`, `drafts`, `publishQueue` (published), `publishQueue` (failed) tables |
| CLEAN-06 | Queue runner has test coverage (`tests/lib/publishing/queue-runner.test.ts`) | See "Queue Runner Test Strategy": mock `@/db/client` and publisher modules with `vi.mock`; test normal publish, failure handling, retry logic, stuck-item recovery, and permanent failure |
</phase_requirements>

## Summary

Phase 1 is a targeted cleanup of four known defects plus two additions. No new infrastructure libraries are required — all work uses existing stack components. The two most complex items are CLEAN-02 (stuck item recovery) and CLEAN-06 (queue runner tests), which are related: the test suite must cover the recovery logic added for CLEAN-02.

The critical schema gap is that `publishQueue` has no `updatedAt` or `processingStartedAt` column. Items enter `publishing` status, but there is no DB timestamp recording when that transition happened. The 15-minute stuck-item detection threshold must either rely on `createdAt` (when the item was originally queued — a loose but workable proxy) or require a one-column schema migration. Since the user chose "simple approach," using `createdAt` is defensible; the planner should decide which path to take and call it out explicitly.

The queue runner test (CLEAN-06) requires mocking Drizzle's chainable query API. The established project pattern is `vi.mock('@/module', ...)` for external dependencies. Drizzle's chain API is not easily spied on, so the recommended approach is mocking `@/db/client` to return a mock `db` object whose `.select()`, `.update()`, and `.from()/.where()/.innerJoin()` methods return controllable promises. Alternatively, using `@electric-sql/pglite` provides real SQL semantics without Docker overhead — the Drizzle community actively recommends this for unit testing.

**Primary recommendation:** Mock `@/db/client` with `vi.mock` for queue-runner unit tests (consistent with how `@/lib/ai/client` is mocked in generator tests), and mock platform publishers (`@/lib/publishing/substack`, `@/lib/publishing/linkedin`) the same way.

## Standard Stack

### Core (already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pg (Pool) | ^8.19.0 | DB connection pool lifecycle | `pool.end()` is the canonical close method; returns `Promise<void>` |
| node-cron | ^4.2.1 | Cron scheduling in daemon | Already in use; provides `task.stop()` for graceful halt |
| drizzle-orm | ^0.45.1 | Database queries for daily summary | All existing DB access uses Drizzle |
| vitest | ^4.0.18 | Test framework for CLEAN-06 | Already configured; `vitest.config.ts` exists |
| tsx | ^4.21.0 | Run daily-summary job directly | Already used for `job:publish` and `job:research` |

### Supporting (optional addition)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @electric-sql/pglite | latest | In-memory Postgres for tests | If full Drizzle chain mocking is too brittle — provides real SQL without Docker |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vi.mock for db | @electric-sql/pglite | PGlite is more realistic but adds a dependency; vi.mock is already the project pattern |
| `createdAt` for stuck detection | Add `processingStartedAt` column | Schema migration adds precision but complexity; `createdAt` is simpler and accurate enough at scale |

**Installation (if PGlite chosen):**
```bash
npm install --save-dev @electric-sql/pglite
```

## Architecture Patterns

### Recommended Project Structure (additions only)

```
src/
├── jobs/
│   ├── publish.ts          # CLEAN-01: replace process.exit(0) with pool.end()
│   ├── research.ts         # CLEAN-01: replace process.exit(0) with pool.end()
│   └── daily-summary.ts    # CLEAN-05: NEW — daily digest job
├── daemon/
│   └── index.ts            # CLEAN-02, CLEAN-03, CLEAN-04: add recovery + SIGTERM + docstring
└── lib/publishing/
    └── queue-runner.ts     # CLEAN-02: add recoverStuckItems() function

tests/
└── lib/publishing/
    └── queue-runner.test.ts  # CLEAN-06: NEW — unit tests for queue runner
```

### Pattern 1: Pool Lifecycle Fix (CLEAN-01)

**What:** Replace bare `process.exit(0)` in job scripts with `pool.end()` in a `finally` block.

**When to use:** Any one-shot Node.js script using a pg Pool. The Pool keeps open connections that prevent natural process exit.

**Current code (broken):**
```typescript
// src/jobs/publish.ts — current
main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('[job:publish] Unhandled error:', err);
    process.exit(1);
  });
```

**Fixed pattern:**
```typescript
// pool must be exported or accessible from db/client
import { pool } from '@/db/client';

async function main(): Promise<void> {
  try {
    await runPublishQueue();
  } finally {
    await pool.end(); // drain all connections, resolves Promise<void>
  }
}

main().catch((err: unknown) => {
  console.error('[job:publish] Unhandled error:', err);
  process.exit(1);
});
// No .then(() => process.exit(0)) — pool.end() drains event loop naturally
```

**Key detail:** `pool.end()` returns `Promise<void>`. After it resolves, no active handles remain and Node.js exits naturally. `process.exit(0)` in the `.then()` chain is what causes the abrupt termination. Remove it — don't just add `pool.end()`.

**IMPORTANT:** `src/db/client.ts` currently exports `db` and the `DB` type but NOT `pool`. The `pool` variable is local. Either export `pool` from `client.ts`, or create a `closePool()` helper function that calls `pool.end()` and export that.

**Source:** [node-postgres pool API](https://node-postgres.com/apis/pool) — HIGH confidence

### Pattern 2: SIGTERM Graceful Shutdown (CLEAN-03)

**What:** Register `process.on('SIGTERM', ...)` in the daemon to allow in-flight publishes to complete before shutdown.

**When to use:** Long-running daemon processes in containerized environments (Kubernetes sends SIGTERM 30 seconds before SIGKILL).

**Implementation:**
```typescript
// src/daemon/index.ts
import { schedule } from 'node-cron';
import { pool } from '@/db/client';
import { runPublishQueue } from '@/lib/publishing/queue-runner';

let isProcessing = false;
let isShuttingDown = false;

async function tick() {
  if (isShuttingDown || isProcessing) {
    console.warn('[daemon] Skipping tick — shutting down or still processing');
    return;
  }
  isProcessing = true;
  try {
    await runPublishQueue();
  } finally {
    isProcessing = false;
  }
}

const task = schedule('* * * * *', () => {
  tick().catch(console.error);
});

async function shutdown(): Promise<void> {
  console.log('[daemon] SIGTERM received — initiating graceful shutdown');
  isShuttingDown = true;
  task.stop(); // Prevent new cron ticks from firing

  // Wait for any in-flight publish to complete (isProcessing drains)
  const TIMEOUT_MS = 25_000; // 25s — leave 5s buffer before Kubernetes SIGKILL
  const deadline = Date.now() + TIMEOUT_MS;
  while (isProcessing && Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
  }
  if (isProcessing) {
    console.warn('[daemon] Shutdown timeout — forcing close with in-flight publish still running');
  }

  await pool.end();
  console.log('[daemon] DB pool closed — exiting');
  process.exit(0);
}

process.on('SIGTERM', () => {
  shutdown().catch(console.error);
});

console.log('[daemon] Publish loop started — checking queue every minute');
```

**node-cron 4.x API (verified):**
- `cron.schedule(expr, fn)` returns a task object
- `task.stop()` — pauses the task (can be restarted); prevents future ticks
- `task.destroy()` — stops and fully removes the task (cannot restart)
- For graceful shutdown, `task.stop()` is sufficient

**Source:** WebSearch + npm docs — MEDIUM confidence (node-cron 4.x API)
**Source:** [Node.js process SIGTERM](https://nodejs.org/api/process.html) — HIGH confidence

### Pattern 3: Stuck Item Recovery (CLEAN-02)

**What:** At the start of each daemon cycle, query for `publishQueue` items with status `publishing` older than 15 minutes and reset them to `queued`.

**Schema constraint:** `publishQueue` has NO `updatedAt` column. Only `createdAt` exists. The `createdAt` timestamp is when the item was first created (enqueued), not when it entered `publishing`. This means:
- If an item was created and processed immediately: `createdAt` ≈ when processing started (accurate)
- If an item was queued and waited: `createdAt` is when it was scheduled (less accurate)
- **Practical result:** Items stuck in `publishing` where `createdAt` is > 15 minutes ago is a superset of truly stuck items. This may also catch legitimately slow items still processing — but given normal publish times (seconds), 15 minutes is safe.

**Option A (no migration — use `createdAt`):**
```typescript
// src/lib/publishing/queue-runner.ts

import { lt, and, eq } from 'drizzle-orm';

export async function recoverStuckItems(): Promise<void> {
  const STUCK_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);

  const stuck = await db
    .select({ id: publishQueue.id })
    .from(publishQueue)
    .where(
      and(
        eq(publishQueue.status, 'publishing'),
        lt(publishQueue.createdAt, cutoff),
      ),
    );

  for (const item of stuck) {
    await db
      .update(publishQueue)
      .set({ status: 'queued' })
      .where(eq(publishQueue.id, item.id));
    console.warn(`[queue-runner] Recovered stuck item ${item.id} — reset to queued`);
  }
}
```

**Option B (add migration — use `processingStartedAt`):**
- Add `processingStartedAt: timestamptz('processing_started_at')` to `publishQueue` table
- Set it when status changes to `publishing`
- Detect stuck items where `processingStartedAt < cutoff`
- Requires: `npm run db:generate && npm run db:migrate`

**Recommendation:** Option A (no migration) is consistent with the user's "simple approach" decision. Flag Option B as a future improvement in code comment.

**Called from daemon tick, before `runPublishQueue()`:**
```typescript
async function tick() {
  await recoverStuckItems(); // Check for stuck items first
  await runPublishQueue();   // Then process due items
}
```

**Source:** Analysis of `src/db/schema.ts` and `src/lib/publishing/queue-runner.ts` on `feature/build` branch — HIGH confidence (direct code inspection)

### Pattern 4: Daily Summary Job (CLEAN-05)

**What:** A new one-shot job `src/jobs/daily-summary.ts` that queries the last 24 hours and logs counts.

**Tables needed:**
- `researchRuns` — filter by `runAt >= cutoff` for research count
- `drafts` — filter by `createdAt >= cutoff` for draft count (all statuses generated)
- `publishQueue` — filter by `publishedAt >= cutoff` and `status = 'published'` for published count
- `publishQueue` — filter by `updatedAt >= cutoff` and `status = 'failed'`... but `publishQueue` has no `updatedAt`. Use `createdAt >= cutoff` and `status = 'failed'` as proxy.

**Implementation pattern:**
```typescript
// src/jobs/daily-summary.ts
import { db } from '@/db/client';
import { pool } from '@/db/client';
import { researchRuns, drafts, publishQueue } from '@/db/schema';
import { and, eq, gte, count } from 'drizzle-orm';

async function main(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [researchCount] = await db
    .select({ count: count() })
    .from(researchRuns)
    .where(gte(researchRuns.runAt, cutoff));

  const [draftCount] = await db
    .select({ count: count() })
    .from(drafts)
    .where(gte(drafts.createdAt, cutoff));

  const [publishedCount] = await db
    .select({ count: count() })
    .from(publishQueue)
    .where(
      and(
        eq(publishQueue.status, 'published'),
        gte(publishQueue.publishedAt, cutoff),
      ),
    );

  const [failedCount] = await db
    .select({ count: count() })
    .from(publishQueue)
    .where(
      and(
        eq(publishQueue.status, 'failed'),
        gte(publishQueue.createdAt, cutoff),
      ),
    );

  const now = new Date().toISOString();
  console.log(`[job:daily-summary] ${now}`);
  console.log(`[job:daily-summary] Research runs (24h): ${researchCount.count}`);
  console.log(`[job:daily-summary] Drafts generated (24h): ${draftCount.count}`);
  console.log(`[job:daily-summary] Items published (24h): ${publishedCount.count}`);
  console.log(`[job:daily-summary] Items failed (24h): ${failedCount.count}`);
}

main()
  .catch((err: unknown) => {
    console.error('[job:daily-summary] Unhandled error:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
```

**npm script to add to `package.json`:**
```json
"job:daily-summary": "tsx src/jobs/daily-summary.ts"
```

**Drizzle `count()` note:** `count()` from `drizzle-orm` returns a number in the select result. Verify the return shape: `{ count: number }` where `count` is a string in raw SQL but Drizzle coerces it — test or cast if needed.

**Source:** Direct analysis of schema + existing job patterns — HIGH confidence

### Pattern 5: Queue Runner Test Strategy (CLEAN-06)

**What:** Unit tests for `src/lib/publishing/queue-runner.ts` covering the four behaviors: normal publish, failure handling, stuck-item recovery, and permanent failure after max retries.

**Approach:** Mock `@/db/client` using `vi.mock` (consistent with how `@/lib/ai/client` is mocked). Also mock `@/lib/publishing/substack` and `@/lib/publishing/linkedin`.

**Challenge:** Drizzle's chainable API (`db.select().from().where()...`) is difficult to spy on. The solution is to mock the `db` object returned by `@/db/client` with a hand-rolled mock that captures calls.

**Recommended mock structure:**
```typescript
// tests/lib/publishing/queue-runner.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db before importing queue-runner
vi.mock('@/db/client', () => {
  const mockDb = {
    select: vi.fn(),
    update: vi.fn(),
  };
  return { db: mockDb };
});

vi.mock('@/lib/publishing/substack', () => ({
  publishToSubstack: vi.fn(),
}));

vi.mock('@/lib/publishing/linkedin', () => ({
  publishToLinkedIn: vi.fn(),
}));

import { runPublishQueue, recoverStuckItems } from '@/lib/publishing/queue-runner';
import { db } from '@/db/client';
import { publishToSubstack } from '@/lib/publishing/substack';

const mockDb = vi.mocked(db);
const mockPublishToSubstack = vi.mocked(publishToSubstack);
```

**Alternative (PGlite — if chain mocking is too brittle):**
```typescript
// vitest.setup.ts (or inline)
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
// vi.mock('@/db/client', () => ({ db: drizzle(new PGlite(), { schema }) }));
```
The PGlite approach requires `npm install --save-dev @electric-sql/pglite` and a schema push in test setup.

**Test cases to cover (per CLEAN-06 requirement and success criteria):**
1. **Normal publish** — `runPublishQueue` finds a due item, sets status to `publishing`, calls platform publisher, sets status to `published`, marks draft `published`
2. **Failure handling** — publisher throws, retry count incremented, status reset to `queued` with future `scheduledFor`, error logged
3. **Permanent failure** — retry count exceeds max (3), status set to `failed`, error logged
4. **Stuck item recovery** — `recoverStuckItems` finds items in `publishing` with `createdAt` older than threshold, resets to `queued`, logs warning
5. **DB update failure** — inner catch (retry DB update throws), error logged, item left stuck (existing behavior)

**Source:** Analysis of existing test patterns in `tests/lib/publishing/substack.test.ts` and `tests/lib/generation/generator.test.ts` — HIGH confidence

### Anti-Patterns to Avoid

- **`process.exit(0)` in `.then()` chained after `main()`:** Terminates the process before the pg Pool can close. The correct fix is `finally { await pool.end() }` inside `main()`, then NO `.then(() => process.exit(0))`.
- **Async SIGTERM handlers that aren't awaited:** `process.on('SIGTERM', asyncFn)` does NOT await the async function. Wrap in `shutdown().catch(console.error)` and have `shutdown` call `process.exit(0)` at the end after awaiting cleanup.
- **Mocking `db` with `vi.spyOn`:** Drizzle's chained query builder returns new objects at each step. `vi.spyOn(db, 'select')` can capture the first call, but the subsequent `.from()`, `.where()`, `.innerJoin()` calls on the returned builder cannot be spied on without custom mock factories.
- **Using `createdAt` for failed item counts in daily summary:** `publishQueue` has no `updatedAt`. Failed items are detected by `status = 'failed'` and `createdAt >= cutoff` — this is correct because items fail shortly after creation in practice, but technically it counts items *created* in the last 24h that are now failed, not items that *became* failed in the last 24h.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pool shutdown | Custom connection drain loop | `pool.end()` | Handles all pool internals, returns Promise |
| Cron halt | Custom setInterval cancellation | `task.stop()` or `task.destroy()` | Built into node-cron task object |
| Drizzle count query | Manual `COUNT(*)` raw SQL | `count()` from `drizzle-orm` | Type-safe, follows project conventions |
| Test DB setup | Fake in-memory data store | `vi.mock` or PGlite | Consistent with existing test patterns |

**Key insight:** This phase is cleanup, not new infrastructure. Every fix uses Node.js built-ins or already-installed libraries.

## Common Pitfalls

### Pitfall 1: Pool Not Exported from db/client.ts

**What goes wrong:** `src/db/client.ts` creates `pool` as a module-local variable and only exports `db` and `DB`. Job scripts importing `@/db/client` cannot call `pool.end()`.

**Why it happens:** The pool was intentionally kept private behind the Drizzle `db` object.

**How to avoid:** Export `pool` from `src/db/client.ts`, OR add a `closePool()` function that calls `pool.end()` and export that. The `closePool()` approach is cleaner (hides the pg Pool type from callers).

**Warning signs:** TypeScript error `Property 'pool' does not exist on type '...'` when trying to import.

### Pitfall 2: SIGTERM Handler Doesn't Wait for In-Flight Publish

**What goes wrong:** Setting `isShuttingDown = true` and calling `task.stop()` stops NEW ticks, but an in-flight `runPublishQueue()` call may still be running. If `pool.end()` is called immediately, the DB connections close mid-publish.

**Why it happens:** `task.stop()` is synchronous — it prevents future scheduled callbacks but cannot cancel an already-running async function.

**How to avoid:** Poll `isProcessing` flag with a timeout loop before calling `pool.end()`. Set a timeout (25 seconds recommended for Kubernetes default 30s grace period) after which shutdown proceeds anyway.

**Warning signs:** Partial publish records in DB — status stuck at `publishing` with no `publishedAt`.

### Pitfall 3: Drizzle count() Returns String, Not Number

**What goes wrong:** Raw PostgreSQL `COUNT(*)` returns a string. Drizzle's `count()` helper may or may not coerce this to a number depending on version.

**Why it happens:** Drizzle ORM version differences in how numeric results are typed.

**How to avoid:** When logging, use `Number(result.count)` or verify the type in a test. Alternatively, use `sql<number>\`count(*)\`` with explicit typing.

**Warning signs:** Log output shows `"5"` (with quotes) instead of `5`.

### Pitfall 4: Stuck Item Detection Uses Wrong Column

**What goes wrong:** `publishQueue.createdAt` is when the item was created (enqueued), not when it entered `publishing`. An item queued early morning and processed at noon would have `createdAt` many hours old — it would incorrectly appear "stuck" even when it just started processing.

**Why it happens:** There is no `processingStartedAt` or `updatedAt` column on `publishQueue`.

**How to avoid:** The 15-minute threshold is tight enough that this edge case is unlikely in practice (items are processed within seconds of becoming due). Add a code comment explaining the limitation. If the system runs high-volume queues where significant delay between creation and processing is common, revisit with a migration.

**Warning signs:** Items that just started processing get reset to `queued` mid-flight.

### Pitfall 5: vi.mock Hoisting with Dynamic Imports

**What goes wrong:** Vitest hoists `vi.mock()` calls before `import` statements, which can cause unexpected initialization order when the mocked module has side effects (e.g., `node-cron` schedules immediately on import).

**Why it happens:** ESM module system + Vitest's mock hoisting.

**How to avoid:** Keep `vi.mock()` calls at the top of the test file (before other imports). The daemon's `schedule()` call fires on import — the queue-runner test file only imports `queue-runner.ts`, not `daemon/index.ts`, so this is not an issue for CLEAN-06.

**Warning signs:** Tests pass in isolation but fail when run together; unexpected console output from cron ticks during tests.

## Code Examples

Verified patterns from code inspection and official sources:

### Export pool from db/client.ts

```typescript
// src/db/client.ts — add pool export
export const pool =
  globalForPg.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

// (existing) export const db = drizzle(pool, { schema });
```

### Job Script with pool.end() (CLEAN-01)

```typescript
// src/jobs/publish.ts — corrected
import { runPublishQueue } from '@/lib/publishing/queue-runner';
import { pool } from '@/db/client';

async function main(): Promise<void> {
  const start = new Date().toISOString();
  console.log(`[job:publish] Starting at ${start}`);

  try {
    await runPublishQueue();
  } finally {
    await pool.end();
  }

  const finish = new Date().toISOString();
  console.log(`[job:publish] Finished at ${finish}`);
}

main().catch((err: unknown) => {
  console.error('[job:publish] Unhandled error:', err);
  process.exit(1);
});
// Note: no .then(() => process.exit(0)) — pool.end() drains naturally
```

### Drizzle count() for Daily Summary

```typescript
import { count, gte, and, eq } from 'drizzle-orm';

const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

const [{ count: researchTotal }] = await db
  .select({ count: count() })
  .from(researchRuns)
  .where(gte(researchRuns.runAt, cutoff));

console.log(`[job:daily-summary] Research runs (24h): ${researchTotal}`);
```

### Queue Runner Test — Mock Setup

```typescript
// tests/lib/publishing/queue-runner.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks — must come before imports that use these modules
vi.mock('@/db/client', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/publishing/substack', () => ({
  publishToSubstack: vi.fn(),
}));

vi.mock('@/lib/publishing/linkedin', () => ({
  publishToLinkedIn: vi.fn(),
}));

import { runPublishQueue } from '@/lib/publishing/queue-runner';
import { db } from '@/db/client';
import { publishToSubstack } from '@/lib/publishing/substack';

const mockDb = db as {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

// Helper to build a chainable select mock
function mockSelect(returnValue: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(returnValue),
  };
  mockDb.select.mockReturnValue(chain);
  return chain;
}

// Helper to build a chainable update mock
function mockUpdate() {
  const chain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  };
  mockDb.update.mockReturnValue(chain);
  return chain;
}
```

### SIGTERM Handler Pattern

```typescript
// process.on with async handler — correct pattern
process.on('SIGTERM', () => {
  // Note: process.on callback is synchronous; launch async work and let it run
  shutdown().catch((err) => {
    console.error('[daemon] Shutdown error:', err);
    process.exit(1);
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `process.exit(0)` in `.then()` | `pool.end()` in `finally` + no forced exit | Always best practice; highlighted by containerization | Pool drains cleanly; no zombie connections |
| Manual signal ignoring | `process.on('SIGTERM', handler)` | Standard since Node.js containerization became common | Kubernetes graceful termination works correctly |
| Single-process cron only | `task.stop()` + shutdown flag | node-cron 4.x | Clean halt without killing in-flight work |

**Deprecated/outdated:**
- `process.exit(0)` at end of async scripts: Works but prevents proper pool teardown. Use `pool.end()` instead.
- `process.on('exit', handler)`: The `exit` event does NOT support asynchronous code. Use `SIGTERM`/`SIGINT` handlers for async cleanup.

## Open Questions

1. **How to detect "stuck in publishing" without `updatedAt`**
   - What we know: `publishQueue` has `createdAt` (enqueue time) but no status-change timestamp
   - What's unclear: Whether `createdAt`-based detection could falsely recover items that were legitimately queued for a long time before processing (e.g., a queue backed up for 20+ minutes)
   - Recommendation: Use `createdAt` for now with the 15-minute threshold (user decision). Add a comment in code about the limitation. If Phase 4 (Deployment) adds more load, revisit with a DB migration.

2. **Drizzle chain mock brittleness**
   - What we know: Drizzle's `.select().from().where()` chain is hard to mock with `vi.spyOn`; `vi.mock` with a hand-rolled chain is the fallback
   - What's unclear: Whether the hand-rolled mock approach will faithfully test the actual query logic (it won't — it tests the glue code, not the SQL)
   - Recommendation: Accept that queue-runner tests are behavioral unit tests (does it call the right functions?) rather than SQL correctness tests. If SQL correctness matters, add an integration test with PGlite separately.

3. **`count()` return type in Drizzle 0.45.x**
   - What we know: PostgreSQL `COUNT(*)` returns a string; Drizzle's `count()` helper wraps it
   - What's unclear: Whether Drizzle 0.45.x coerces to `number` automatically
   - Recommendation: Use `Number(result.count)` defensively in the daily summary job output.

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `feature/build` branch — all source files read and analyzed
- `.planning/codebase/ARCHITECTURE.md`, `STACK.md`, `STRUCTURE.md`, `TESTING.md`, `CONCERNS.md` — analyzed
- [node-postgres pool API](https://node-postgres.com/apis/pool) — `pool.end()` behavior verified

### Secondary (MEDIUM confidence)
- [node-cron npm](https://www.npmjs.com/package/node-cron) — `.stop()` and `.destroy()` API confirmed via WebSearch + npm docs
- [Node.js process docs](https://nodejs.org/api/process.html) — SIGTERM handling patterns
- WebSearch: "node-cron v4 task.stop() task.destroy() API" — multiple sources confirm API

### Tertiary (LOW confidence)
- WebSearch: vitest + drizzle mock patterns — community consensus around PGlite; `vi.mock` chain approach inferred from project patterns
- Drizzle `count()` return type — assumed from PostgreSQL behavior; needs runtime verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, versions confirmed from package.json
- Architecture: HIGH — code directly inspected on feature/build branch
- Pitfalls: HIGH — derived from direct code analysis (CONCERNS.md + schema inspection)
- Test patterns: MEDIUM — vi.mock approach inferred from project patterns; chain mock structure is untested

**Research date:** 2026-02-27
**Valid until:** 2026-04-27 (stable domain — node-cron, pg, vitest APIs are stable)
