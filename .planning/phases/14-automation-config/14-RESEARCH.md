# Phase 14: Automation Config - Research

**Researched:** 2026-03-14
**Domain:** Next.js 16 / Drizzle ORM / PostgreSQL — schedule CRUD schema, API routes, React client UI
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Schedule Input UX:** Interval picker with named presets only (no cron string input). Options: "Twice daily" (12h), "Daily" (24h), "Every other day" (48h), "Every 3 days" (72h), "Weekly" (168h). Show "Next run" preview below the picker. Store as cron expression internally.
- **Settings Placement (AUTO-05):** Automation config lives at `/research/[id]/automation` — NOT a section in ResearcherForm. Researcher detail page must add a navigation link to the automation page.
- **Schema: Separate `automationSchedules` table** with FK to `researchers.id`. Columns: name (optional), cronExpression (text), enabled (boolean), nextRunAt (timestamp).
- **Per-Schedule Overrides:** Each schedule can override `maxDraftsPerRun` and `autoDraft` from researcher defaults. Override columns are nullable — null means "inherit from researcher". Override fields start empty. Worker resolves: `schedule.maxDraftsPerRun ?? researcher.maxDraftsPerRun`.
- **Multiple Schedules:** Card list UI on `/research/[id]/automation`. Each schedule is a card showing interval, next run time, overrides. "Add Schedule" button. Edit and delete actions on each card. Overlapping schedules run concurrently (no skip/queue logic).

### Claude's Discretion
- Card component styling and layout details
- How the "Add Schedule" form is presented (inline vs modal vs separate view)
- Cron expression generation from interval presets (mapping "Daily" to `0 0 * * *` etc.)
- "Next run" time calculation logic
- Whether to show schedule run history on the automation page
- API route structure for schedule CRUD

### Deferred Ideas (OUT OF SCOPE)
- Cron expression power-user input
- Schedule run history on the automation page
- Skip-if-running overlap prevention
- Timezone configuration per schedule
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTO-01 | User can configure an automation schedule for a researcher (cron expression or interval) | Interval picker presets map to cron expressions; `automationSchedules` table stores them; CRUD API under `/api/researchers/[id]/schedules/` |
| AUTO-02 | User can toggle auto-draft generation on/off per automation schedule | `autoDraft` nullable boolean column on `automationSchedules` — null inherits researcher default |
| AUTO-03 | User can set max drafts per scheduled run in automation config | `maxDraftsPerRun` nullable integer column on `automationSchedules` — null inherits researcher default |
| AUTO-05 | Automation config is separate from research source config | Own page at `/research/[id]/automation`; no changes to `ResearcherForm` |
</phase_requirements>

---

## Summary

Phase 14 builds the storage, API, and UI for researcher automation schedules. The work is purely CRUD: a new `automationSchedules` table, four REST endpoints under `/api/researchers/[id]/schedules/`, and a new Next.js page at `/research/[id]/automation` with a card-list UI. No real-time features, no cron evaluation — that belongs to Phase 15.

The project already has all the infrastructure needed: Drizzle ORM with PostgreSQL, the `drizzle-kit generate` / `push` migration workflow, the established API route pattern (`auth()` wrapper, `apiError` helper), shadcn/ui primitives (Button, Input, Label, Select, Card, Dialog), and `node-cron` for cron expression validation and next-run calculation.

The only genuinely novel piece is "next run" time calculation. `node-cron` v4.2.1 exposes an internal `TimeMatcher.getNextMatch(date)` method that returns a `Date` for the next firing of a cron expression. This is not part of the public API documentation but is verified to work in the installed version. A small utility function wraps this to keep implementation details contained.

**Primary recommendation:** Follow the established pattern exactly — Drizzle schema + migration, `auth()`-wrapped API routes using `apiError`, server-component page with `force-dynamic`, client-component form using shadcn/ui primitives.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.1 | Schema definition, DB queries | Already the project ORM |
| drizzle-kit | ^0.31.9 | Migration generation (`drizzle-kit generate`) | Already the migration tool |
| next (App Router) | 16.1.6 | Route segments, server/client components | Project framework |
| @radix-ui/react-select | ^2.2.6 | Interval picker dropdown | Already installed |
| @radix-ui/react-dialog | ^1.1.15 | Add/Edit schedule modal (if modal UX chosen) | Already installed |
| node-cron | ^4.2.1 | `validate()` for cron string safety; `TimeMatcher.getNextMatch()` for next-run preview | Already in dependencies |
| lucide-react | ^0.575.0 | Icons (calendar, trash, toggle) | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | ^2.0.7 | `toast.success` / `toast.error` after schedule mutations | Match existing form pattern |
| zod | ^3.25.76 | API request body validation | Match existing pattern where body is validated |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node-cron` `TimeMatcher.getNextMatch` | `cronstrue` or manual date math | `node-cron` is already installed; `cronstrue` gives human strings not dates; manual math is error-prone |
| Dialog modal for Add/Edit | Inline expanded card or separate page | Modal matches project's existing shadcn Dialog; keeps automation page clean |

**No new installations required.** All libraries are already in `package.json`.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── db/
│   ├── schema.ts                          # Add automationSchedules table
│   └── migrations/
│       └── 0006_automation_schedules.sql  # Generated by drizzle-kit
├── app/
│   ├── api/researchers/[id]/
│   │   └── schedules/
│   │       ├── route.ts                   # GET list, POST create
│   │       └── [scheduleId]/
│   │           └── route.ts               # PUT update, DELETE
│   └── (app)/research/[id]/
│       └── automation/
│           ├── page.tsx                   # Server component, force-dynamic
│           └── loading.tsx                # Skeleton loader (matches sibling pages)
└── components/research/
    ├── ScheduleCard.tsx                   # Card for one schedule (client)
    ├── ScheduleForm.tsx                   # Add/Edit form (client, used in Dialog)
    └── ScheduleList.tsx                   # Orchestrates card list + Add button (client)
```

### Pattern 1: Drizzle Table Definition
**What:** Add `automationSchedules` table to `src/db/schema.ts` following existing table conventions.
**When to use:** Always — single source of truth for DB types.
**Example:**
```typescript
// src/db/schema.ts — add below researcherChannels
export const automationSchedules = pgTable('automation_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  researcherId: uuid('researcher_id')
    .references(() => researchers.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name'),                          // optional, user-defined label
  cronExpression: text('cron_expression').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  nextRunAt: timestamptz('next_run_at'),        // nullable — computed at create/update
  autoDraft: boolean('auto_draft'),             // null = inherit from researcher
  maxDraftsPerRun: integer('max_drafts_per_run'), // null = inherit from researcher
  createdAt: timestamptz('created_at').defaultNow().notNull(),
  updatedAt: timestamptz('updated_at').defaultNow().notNull(),
});
```

### Pattern 2: API Route — Collection (GET + POST)
**What:** `auth()`-wrapped handler at `/api/researchers/[id]/schedules/route.ts`.
**When to use:** List and create operations on the schedules collection.
**Example:**
```typescript
// Source: existing routes in src/app/api/researchers/[id]/route.ts
import { auth } from '@/auth';
import { db } from '@/db/client';
import { automationSchedules } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiError } from '@/lib/errors';

export const GET = auth(function GET(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return (async () => {
    try {
      const { id } = await (ctx?.params as Promise<{ id: string }>);
      const schedules = await db
        .select()
        .from(automationSchedules)
        .where(eq(automationSchedules.researcherId, id));
      return NextResponse.json(schedules);
    } catch (err) {
      const { message, status } = apiError('list schedules', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
```

### Pattern 3: Next Run Preview Utility
**What:** Wraps `node-cron`'s internal `TimeMatcher.getNextMatch(date)` to compute the next firing date for a cron expression.
**When to use:** Both API side (persist `nextRunAt` on create/update) and UI side (show "Next run" preview during form interaction).
**Important:** `TimeMatcher` is not exported from `node-cron`'s public surface. Import from the internal path or use a standalone calculation. Use `undefined` (not `null`) for timezone to avoid a RangeError.

```typescript
// src/lib/cron-utils.ts
import { validate } from 'node-cron';

// Internal import — verified working on node-cron 4.2.1
// If this breaks on upgrade, replace with manual date math
import { TimeMatcher } from 'node-cron/dist/cjs/time/time-matcher';

export function getNextRunAt(cronExpression: string, from: Date = new Date()): Date | null {
  if (!validate(cronExpression)) return null;
  try {
    const matcher = new TimeMatcher(cronExpression, undefined);
    return matcher.getNextMatch(from);
  } catch {
    return null;
  }
}
```

### Pattern 4: Interval Preset → Cron Expression Map
**What:** Locked mapping from user-friendly label to stored cron expression.
**When to use:** ScheduleForm — converts selected preset to cronExpression before saving.
```typescript
// src/lib/cron-utils.ts
export const INTERVAL_PRESETS = [
  { label: 'Twice daily',    hours: 12,  cron: '0 */12 * * *' },
  { label: 'Daily',          hours: 24,  cron: '0 0 * * *'    },
  { label: 'Every other day',hours: 48,  cron: '0 0 */2 * *'  },
  { label: 'Every 3 days',   hours: 72,  cron: '0 0 */3 * *'  },
  { label: 'Weekly',         hours: 168, cron: '0 0 * * 0'    },
] as const;

export type IntervalPreset = typeof INTERVAL_PRESETS[number];
```

All five expressions validated against `node-cron.validate()` — all return `true`.

### Pattern 5: Server Component Page with force-dynamic
**What:** Automation page fetches schedules server-side, passes to client component list.
**When to use:** Matches `/research/[id]/runs/page.tsx` pattern — server component, `force-dynamic`, serialize dates before passing to client.
```typescript
// src/app/(app)/research/[id]/automation/page.tsx
export const dynamic = 'force-dynamic';

export default async function AutomationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [researcher] = await db.select().from(researchers).where(eq(researchers.id, id));
  if (!researcher) notFound();

  const schedules = await db
    .select()
    .from(automationSchedules)
    .where(eq(automationSchedules.researcherId, id));

  const serialized = schedules.map(s => ({
    ...s,
    nextRunAt: s.nextRunAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  return (
    // header with back link, researcher name, then ScheduleList client component
  );
}
```

### Pattern 6: Navigation Link on Researcher Detail Page
**What:** Add "Automation" button to `/research/[id]/page.tsx` header alongside the existing "View Runs" button.
**When to use:** Required for AUTO-05 — automation page must be navigable from researcher detail.
```tsx
// In src/app/(app)/research/[id]/page.tsx, alongside existing "View Runs" Button:
<Button asChild variant="outline" size="sm">
  <Link href={`/research/${id}/automation`}>Automation</Link>
</Button>
```

### Anti-Patterns to Avoid
- **Modifying ResearcherForm:** The locked decision explicitly forbids this. Automation is a separate page — do not add a section to the existing form.
- **Storing interval hours instead of cron expressions:** The schema stores `cronExpression` (string), not hours. This preserves flexibility for Phase 15.
- **Calling `validate()` only on save:** Also call it server-side in the POST/PUT handler — belt-and-suspenders against direct API calls.
- **Using `null` timezone in TimeMatcher:** Pass `undefined` to avoid a `RangeError: Invalid time zone specified: null`.
- **Importing TimeMatcher without a try/catch:** The internal import path could change on `node-cron` upgrades. Wrap in try/catch and fall back gracefully (return null, skip preview).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron expression validation | Custom regex | `node-cron` `validate()` | node-cron handles all five-field and six-field edge cases |
| Next firing date for a cron expression | Manual date arithmetic | `node-cron` `TimeMatcher.getNextMatch(date)` | Handles month boundaries, leap years, DST rollover correctly |
| Modal dialog | Custom overlay + portal | shadcn `Dialog` (`@radix-ui/react-dialog`) | Already installed; handles focus trap, escape, a11y |
| Interval dropdown | Custom select element | shadcn `Select` (`@radix-ui/react-select`) | Already installed with full keyboard navigation |

**Key insight:** Every helper needed for this phase is already installed. Zero new dependencies.

---

## Common Pitfalls

### Pitfall 1: Date Serialization Between Server and Client
**What goes wrong:** Passing `Date` objects from server component to client component causes a serialization error — Next.js requires plain JSON across the server/client boundary.
**Why it happens:** `Date` is not a JSON-serializable primitive in Next.js Server Components.
**How to avoid:** Call `.toISOString()` on all timestamp columns in the server component before passing to client. Match the pattern in `runs/page.tsx` (`runAt: r.runAt.toISOString()`).
**Warning signs:** "Only plain objects can be passed to Client Components from Server Components" error at runtime.

### Pitfall 2: TimeMatcher Internal Import Fragility
**What goes wrong:** `import { TimeMatcher } from 'node-cron/dist/cjs/time/time-matcher'` is an internal path not in the public API. It could break on a patch upgrade.
**Why it happens:** node-cron 4.x does not expose `getNextMatch` through its public exports.
**How to avoid:** Isolate the import in `src/lib/cron-utils.ts`. Wrap in try/catch. Return `null` and skip the preview if it throws. Add a comment explaining why it's internal and what to do if it breaks.
**Warning signs:** Import error after a `node-cron` version bump.

### Pitfall 3: nextRunAt Staleness
**What goes wrong:** `nextRunAt` stored in the DB becomes stale as time passes — it only represents when the run fires, not whether the schedule is still valid.
**Why it happens:** The DB value is calculated once at create/update time. It won't auto-update.
**How to avoid:** This is intentional for Phase 14. Phase 15 (the worker) is responsible for refreshing `nextRunAt` after each automated run executes. The UI shows the stored value as-is. Document this contract clearly in code comments.

### Pitfall 4: Missing `onDelete: 'cascade'` on FK
**What goes wrong:** Deleting a researcher leaves orphaned `automation_schedules` rows.
**Why it happens:** Forgetting the cascade option on the FK definition in Drizzle schema.
**How to avoid:** Always use `.references(() => researchers.id, { onDelete: 'cascade' })` on the `researcherId` FK — same pattern as `researcherChannels`.

### Pitfall 5: Schedule Enable/Disable Race in UI
**What goes wrong:** User rapidly toggles enabled state; two concurrent PATCH requests create inconsistent state.
**Why it happens:** Client-side state update is optimistic without request deduplication.
**How to avoid:** Disable the toggle button while the PUT request is in-flight (`loading` state). Match the pattern in `ResearcherForm` where the submit button is disabled during save.

---

## Code Examples

### Migration Generation Command
```bash
# From project root — generates SQL migration from schema diff
npx drizzle-kit generate
# Output: src/db/migrations/0006_automation_schedules.sql (or next sequence)

# Apply to dev database
npx drizzle-kit push
```

### Drizzle Query: List Schedules for a Researcher
```typescript
// Source: Drizzle ORM patterns from existing routes
const schedules = await db
  .select()
  .from(automationSchedules)
  .where(eq(automationSchedules.researcherId, researcherId))
  .orderBy(automationSchedules.createdAt);
```

### Drizzle Insert: Create Schedule
```typescript
const [created] = await db
  .insert(automationSchedules)
  .values({
    researcherId,
    name: body.name ?? null,
    cronExpression: body.cronExpression,
    enabled: body.enabled ?? true,
    nextRunAt: getNextRunAt(body.cronExpression),
    autoDraft: body.autoDraft ?? null,
    maxDraftsPerRun: body.maxDraftsPerRun ?? null,
  })
  .returning();
```

### Drizzle Update: Update Schedule
```typescript
const [updated] = await db
  .update(automationSchedules)
  .set({
    ...updates,
    nextRunAt: getNextRunAt(updates.cronExpression ?? existing.cronExpression),
    updatedAt: new Date(),
  })
  .where(
    and(
      eq(automationSchedules.id, scheduleId),
      eq(automationSchedules.researcherId, researcherId), // scope check
    )
  )
  .returning();
```

### Drizzle Delete: Delete Schedule
```typescript
// Verify ownership — scheduleId alone is insufficient; scope by researcherId
await db
  .delete(automationSchedules)
  .where(
    and(
      eq(automationSchedules.id, scheduleId),
      eq(automationSchedules.researcherId, researcherId),
    )
  );
return new NextResponse(null, { status: 204 });
```

### Next Run Preview Display
```typescript
// In ScheduleForm client component
import { getNextRunAt, INTERVAL_PRESETS } from '@/lib/cron-utils';

const selectedPreset = INTERVAL_PRESETS.find(p => p.cron === cronExpression);
const nextRun = cronExpression ? getNextRunAt(cronExpression) : null;

// Display: "Next run: Monday Mar 16 at ~3:00 PM"
const nextRunLabel = nextRun
  ? nextRun.toLocaleString('en-US', { weekday:'long', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })
  : null;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Schedule hours in `sourceConfig` JSON | Separate `automationSchedules` table | Phase 12 removed `scheduleHours` | Phase 14 starts clean — no migration of old schedule data |
| `autoDraft` only on researcher | Override pattern: null = inherit | This phase | Worker in Phase 15 must resolve `schedule.autoDraft ?? researcher.autoDraft` |

**No deprecated patterns to worry about for this phase.** Phase 12 already removed `scheduleHours` from `ResearchConfig`.

---

## Open Questions

1. **`drizzle-kit generate` naming**
   - What we know: Migrations are named by drizzle-kit automatically (`0006_<adjective>_<name>.sql`).
   - What's unclear: The exact output filename is unknown until generation runs.
   - Recommendation: Run `npx drizzle-kit generate` as the first task in Wave 1; the filename will be determined then.

2. **`and()` import in Drizzle ORM**
   - What we know: `eq`, `desc`, `sql` are used in existing routes but `and()` (for multi-condition WHERE) has not been used yet.
   - What's unclear: Whether `and` is re-exported from `drizzle-orm` or requires a subpath import.
   - Recommendation: Import from `'drizzle-orm'` — `and` is a standard export alongside `eq`. Verify at implementation time.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run tests/lib/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTO-01 | `INTERVAL_PRESETS` maps all 5 labels to valid cron expressions | unit | `npx vitest run tests/lib/cron-utils.test.ts -t "INTERVAL_PRESETS"` | ❌ Wave 0 |
| AUTO-01 | `getNextRunAt` returns a future Date for each preset | unit | `npx vitest run tests/lib/cron-utils.test.ts -t "getNextRunAt"` | ❌ Wave 0 |
| AUTO-01 | `getNextRunAt` returns null for invalid expression | unit | `npx vitest run tests/lib/cron-utils.test.ts -t "invalid"` | ❌ Wave 0 |
| AUTO-02 | `autoDraft` nullable column — null stored and retrieved correctly | manual-only | n/a — DB integration; verify via API smoke test | n/a |
| AUTO-03 | `maxDraftsPerRun` nullable column — null stored and retrieved correctly | manual-only | n/a — DB integration; verify via API smoke test | n/a |
| AUTO-05 | Automation page renders at `/research/[id]/automation` | manual-only | n/a — Next.js page route; verify in browser | n/a |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/lib/cron-utils.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/lib/cron-utils.test.ts` — covers AUTO-01 (preset mapping, getNextRunAt, invalid expression handling)

*(All other test coverage is manual-only — DB schema correctness and UI rendering are verified by smoke testing the running app, not unit tests.)*

---

## Sources

### Primary (HIGH confidence)
- Codebase: `src/db/schema.ts` — Drizzle table definitions, column types, FK cascade pattern
- Codebase: `src/app/api/researchers/[id]/route.ts` — `auth()` wrapper, `apiError`, `returning()` pattern
- Codebase: `src/app/(app)/research/[id]/runs/page.tsx` — server component page, `force-dynamic`, date serialization
- Codebase: `src/daemon/index.ts` — `node-cron` import pattern, `schedule()` usage
- Node.js REPL: `node-cron` v4.2.1 — `validate()` confirmed working on all 5 preset expressions; `TimeMatcher.getNextMatch(date, undefined)` confirmed returning correct next Date

### Secondary (MEDIUM confidence)
- `node_modules/.pnpm/node-cron@4.2.1/.../time-matcher.js` — internal source read directly; `getNextMatch` signature is `getNextMatch(date: Date): Date`; timezone `undefined` works, `null` throws RangeError

### Tertiary (LOW confidence)
- None — all findings verified against installed codebase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in `package.json` and node_modules
- Architecture: HIGH — patterns derived directly from existing routes and pages in codebase
- Pitfalls: HIGH — date serialization and cascade FK verified against existing patterns; TimeMatcher fragility verified by running the code

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable domain; main risk is node-cron internal API change on patch upgrade)
