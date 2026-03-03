# Phase 12: Config Cleanup - Research

**Researched:** 2026-03-02
**Domain:** Drizzle ORM schema migration, Next.js API routes, React form state, shadcn/ui
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Field Relocation**
- `maxDraftsPerRun` becomes a top-level integer column on the `researchers` table (not JSON)
- `contentTypeMix` becomes a `shortFormPercent` top-level integer column on the `researchers` table (0-100, default 70)
- `scheduleHours` is removed entirely — no new home, Phase 14's automation config replaces it
- `sourceConfig` keeps its current name — after cleanup it contains only research source fields (subreddits, feeds, queries, exclusions)
- Phase 14 automation schedules will be able to override `maxDraftsPerRun` per schedule (per AUTO-03), so the researcher-level value acts as the default

**Content Type Model**
- Two generic content types: short-form and long-form (platform-agnostic)
- Publisher modules will declare what content types they support plus constraints — this is Phase 13 work
- For Phase 12: just move the field to `shortFormPercent` column with a slider UI
- Article writing UI will always output HTML; publisher adapters convert — Phase 13+ work

**Short-form vs Long-form UX**
- Replace the bare "Note %" number input with a slider
- Slider: left side labeled "Short-form", right side labeled "Long-form", thumb shows the split percentage
- Helper text frames both length and purpose: short-form = quick takes that keep you visible, long-form = in-depth pieces that build authority

**Migration**
- Silent migration — no user notification
- Drizzle SQL migration only (no separate TypeScript migration script)
- SQL migration: add `maxDraftsPerRun` and `shortFormPercent` columns, extract values from sourceConfig JSON using SQL functions, strip old fields from sourceConfig JSON
- Default values: `maxDraftsPerRun: 3`, `shortFormPercent: 70`
- Old fields removed from sourceConfig JSON immediately (no transition period)

**Form Reorganization**
- Split the researcher form into visual sections with headings/dividers:
  - Research Identity — name, topics, keywords
  - Sources — subreddits, Substack feeds, search query templates, excluded domains
  - Draft Settings — short-form vs long-form slider, max drafts per run
  - Channels — linked channel multi-select
- Draft settings appear as a section within the same form (not a separate tab)

**Dead Code Cleanup**
- Delete `ResearchConfigForm.tsx` — dead code since Phase 11 removed the Research Config tab
- Clean up `ResearchConfig` type in schema.ts — remove `maxDraftsPerRun`, `scheduleHours`, `contentTypeMix` fields

### Claude's Discretion
- Exact slider component implementation (may need to add shadcn/ui slider)
- Helper text wording for the short-form vs long-form slider
- Section heading styling (dividers, spacing, typography)
- Whether to show a live draft count preview below the slider
- How to handle the legacy `runResearchForChannel` code path if it still references cleaned-up fields

### Deferred Ideas (OUT OF SCOPE)
- Publisher content type declarations (short-form max chars, long-form HTML mapper interface) — Phase 13
- HTML-based article writing UI — Phase 13
- Platform-specific content type mapping in publisher adapters — Phase 13
- Automation schedule overriding maxDraftsPerRun — Phase 14
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CFG-01 | maxDraftsPerRun moved from research source config to draft generation / automation settings | New `max_drafts_per_run` integer column on `researchers` table; SQL migration extracts value from `source_config` JSON; form gains "Draft Settings" section |
| CFG-02 | notePercent renamed to "Note vs Article %" with clear description of what notes and articles are | CONTEXT.md overrides this: field becomes `shortFormPercent` integer column and renders as a "Short-form vs Long-form %" slider with helper text |
| CFG-03 | scheduleHours removed from research source config (replaced by automation config) | `scheduleHours` dropped from `ResearchSourceConfig` interface and from `source_config` JSON via SQL migration; field removed from form |
</phase_requirements>

---

## Summary

Phase 12 is a pure refactoring phase with no new capabilities: three fields (`maxDraftsPerRun`, `contentTypeMix`, `scheduleHours`) are removed from the `ResearchSourceConfig` JSON blob stored in `source_config`, two of them reappear as top-level integer columns on the `researchers` table, and one is deleted entirely. The researchers table currently has `id`, `name`, `topics`, `keywords`, `source_config`, `created_at`, and `updated_at` — two new columns will be added via a Drizzle-generated SQL migration that also back-fills values from the existing JSON.

The work spans four layers: (1) schema and migration, (2) API routes, (3) engine/adapter code, and (4) the form UI. The most delicate part is the SQL migration: PostgreSQL's `jsonb` operators can extract and delete keys in a single migration file, so no TS migration script is needed. The UI change replaces a number input with a slider; since `@radix-ui/react-slider` is not currently installed, it must be added as a dependency and a shadcn/ui `Slider` component created.

The adapter layer (exa, reddit, substack-monitor, brainstorm) does NOT directly read `contentTypeMix`, `maxDraftsPerRun`, or `scheduleHours` — those fields are only present in `ResearchConfig` because `buildResearchConfig()` copies them there. Since the adapters receive `ResearchConfig` but never access these three fields, removing them from the type is safe without touching any adapter file.

**Primary recommendation:** Generate the Drizzle migration first (schema change drives everything else), then propagate type changes outward to API routes, engine, form, and tests.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.1 | ORM and schema definition | Already in use; pgTable column additions follow existing patterns |
| drizzle-kit | ^0.31.9 | Migration generation (`db:generate`) | Project's established migration tool |
| @radix-ui/react-slider | ^1.x | Headless slider primitive | Required for shadcn/ui Slider component; matches existing @radix-ui usage |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^4.0.18 | Test runner | Tests live in `tests/` and reference the changed types — must update |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@radix-ui/react-slider` + shadcn component | Plain HTML `<input type="range">` | HTML range input requires manual CSS for track/thumb styling and value labels; shadcn slider is already the pattern for all other form controls |
| SQL-only migration | SQL + TS backfill script | TS backfill gives more control but context decisions locked SQL-only for simplicity |

**Installation (new dependency only):**
```bash
pnpm add @radix-ui/react-slider
```

---

## Architecture Patterns

### Current State (what exists)
```
src/
├── db/
│   ├── schema.ts              # ResearchSourceConfig has 3 fields to remove; ResearchConfig has 3 fields to remove
│   ├── migrations/
│   │   └── 0003_regular_karma.sql  # Last migration (created researchers table)
│   └── migrate-research-configs.ts # Phase 8 TS migration (dead, keep as reference)
├── lib/research/
│   └── engine.ts              # buildResearchConfig() reads from sourceConfig — fix here
├── components/
│   ├── research/ResearcherForm.tsx  # Add sections + slider
│   ├── channels/ResearchConfigForm.tsx  # DELETE (dead code)
│   └── ui/                    # Add slider.tsx here
└── app/api/researchers/
    ├── route.ts               # POST default values need updating
    └── [id]/route.ts          # PUT handler: accept maxDraftsPerRun, shortFormPercent at top level
```

### Target State (after phase)
```
src/
├── db/
│   ├── schema.ts              # researchers table has maxDraftsPerRun + shortFormPercent columns
│   │                          # ResearchSourceConfig: only subreddits/feeds/queries/exclusions
│   │                          # ResearchConfig: remove 3 fields (or make optional for legacy)
│   └── migrations/
│       └── 0004_*.sql         # New migration (drizzle-kit generate)
├── lib/research/
│   └── engine.ts              # buildResearchConfig() reads from researcher top-level columns
├── components/
│   ├── research/ResearcherForm.tsx  # Sectioned form with Slider component
│   └── ui/
│       └── slider.tsx         # New shadcn Slider wrapper
└── app/api/researchers/
    ├── route.ts               # POST accepts maxDraftsPerRun, shortFormPercent (not in sourceConfig)
    └── [id]/route.ts          # PUT handles maxDraftsPerRun, shortFormPercent at top level
```

### Pattern 1: Drizzle Schema Column Addition

**What:** Add `integer` columns to an existing table with `.default()` values so they are non-null from the start.
**When to use:** Promoting JSON sub-fields to proper columns.

```typescript
// Source: src/db/schema.ts — follows existing integer column pattern
export const researchers = pgTable('researchers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  topics: jsonb('topics').$type<string[]>().default([]).notNull(),
  keywords: jsonb('keywords').$type<string[]>().default([]).notNull(),
  sourceConfig: jsonb('source_config').$type<ResearchSourceConfig>().notNull(),
  maxDraftsPerRun: integer('max_drafts_per_run').default(3).notNull(),
  shortFormPercent: integer('short_form_percent').default(70).notNull(),
  createdAt: timestamptz('created_at').defaultNow().notNull(),
  updatedAt: timestamptz('updated_at').defaultNow().notNull(),
});
```

### Pattern 2: SQL Migration with jsonb Key Extraction + Deletion

**What:** A single migration file adds the columns, back-fills from JSON, and strips the old JSON keys.
**When to use:** Silent data migration from JSON sub-field to scalar column.

```sql
-- Add new columns with defaults (handles rows with no JSON value)
ALTER TABLE "researchers"
  ADD COLUMN "max_drafts_per_run" integer NOT NULL DEFAULT 3,
  ADD COLUMN "short_form_percent" integer NOT NULL DEFAULT 70;

-- Back-fill from existing sourceConfig JSON
-- contentTypeMix was: { "note": N, "article": M } — extract note percentage
UPDATE "researchers"
SET
  "max_drafts_per_run" = COALESCE(
    (source_config->>'maxDraftsPerRun')::integer,
    3
  ),
  "short_form_percent" = COALESCE(
    (source_config->'contentTypeMix'->>'note')::integer,
    70
  );

-- Strip migrated fields from the JSON blob
UPDATE "researchers"
SET source_config = source_config
  - 'maxDraftsPerRun'
  - 'scheduleHours'
  - 'contentTypeMix';
```

**IMPORTANT:** `drizzle-kit generate` will produce the `ALTER TABLE` statements automatically from the schema change. The back-fill `UPDATE` statements and the JSON `- 'key'` stripping must be hand-added to the generated migration file BEFORE running `db:migrate`.

### Pattern 3: shadcn/ui Slider Component

**What:** Thin wrapper around `@radix-ui/react-slider` following the shadcn component pattern.
**When to use:** Any percentage/range input needing styled track + thumb.

```tsx
// src/components/ui/slider.tsx — follows shadcn convention (see button.tsx, input.tsx)
'use client';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

export function Slider({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn('relative flex w-full touch-none select-none items-center', className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
    </SliderPrimitive.Root>
  );
}
```

### Pattern 4: ResearcherForm Section Structure

**What:** Visual grouping of form fields using headings and border dividers, without adding new state management.
**When to use:** Long single-screen forms where field groups have clear semantic separation.

```tsx
// Example section structure — follows existing spacing conventions
<div className="space-y-6">
  {/* Research Identity */}
  <div className="space-y-4">
    <h3 className="text-sm font-semibold text-foreground">Research Identity</h3>
    {/* name, topics, keywords fields */}
  </div>

  <div className="border-t border-border" />

  {/* Sources */}
  <div className="space-y-4">
    <h3 className="text-sm font-semibold text-foreground">Sources</h3>
    {/* subreddits, feeds, exclusions, query templates */}
  </div>

  <div className="border-t border-border" />

  {/* Draft Settings */}
  <div className="space-y-4">
    <h3 className="text-sm font-semibold text-foreground">Draft Settings</h3>
    {/* slider + maxDraftsPerRun input */}
  </div>

  <div className="border-t border-border" />

  {/* Channels */}
  <div className="space-y-4">
    <h3 className="text-sm font-semibold text-foreground">Channels</h3>
    {/* channel multi-select */}
  </div>
</div>
```

### Pattern 5: buildResearchConfig() Updated Signature

**What:** The engine's config-building function reads `maxDraftsPerRun` and `shortFormPercent` from the researcher's top-level columns instead of `sourceConfig`.

```typescript
// src/lib/research/engine.ts
function buildResearchConfig(
  researcher: {
    topics: string[];
    keywords: string[];
    sourceConfig: ResearchSourceConfig;
    maxDraftsPerRun: number;
    shortFormPercent: number;
  },
  channelId: string,
  voiceProfile: VoiceProfile | null,
  recentTitles: string[],
): ResearchConfig {
  return {
    topics: researcher.topics,
    keywords: researcher.keywords,
    subreddits: researcher.sourceConfig.subreddits,
    substackFeeds: researcher.sourceConfig.substackFeeds,
    searchQueryTemplates: researcher.sourceConfig.searchQueryTemplates,
    excludedDomains: researcher.sourceConfig.excludedDomains,
    maxDraftsPerRun: researcher.maxDraftsPerRun,
    shortFormPercent: researcher.shortFormPercent,
    channelId,
    voiceProfile,
    recentTitles,
  };
}
```

### Anti-Patterns to Avoid

- **Editing the generated SQL migration directly without adding back-fill:** drizzle-kit generates only the `ALTER TABLE` DDL. If you run migrate before adding the `UPDATE` back-fill, existing rows get the default values (3 / 70) regardless of what was in their JSON — silent data loss for customized configs.
- **Removing `contentTypeMix` / `maxDraftsPerRun` / `scheduleHours` from `ResearchConfig` before verifying adapters don't use them:** Confirmed safe — no adapter file reads these fields from config. But TypeScript will catch this at compile time if any adapter does.
- **Forgetting to update the form state type:** `ResearcherForm` currently uses `ResearchSourceConfig` for its `sourceConfig` state. After the phase, `shortFormPercent` and `maxDraftsPerRun` are top-level form fields, not inside `sourceConfig` state.
- **Leaving `ResearchConfigForm.tsx` in place:** It imports `ResearchConfig` and has `scheduleHours`, `contentTypeMix`, `maxDraftsPerRun` in its defaults. TypeScript will error after schema cleanup if it isn't deleted.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slider UI with track/thumb/labels | Custom `<input type="range">` with CSS | `@radix-ui/react-slider` via shadcn Slider component | Handles keyboard navigation, ARIA, value array API, and range use cases; matches existing component system |
| JSON key extraction in migration | TS migration script that fetches+updates rows | PostgreSQL `jsonb ->'key'` and `jsonb - 'key'` operators | Pure SQL is atomic, idempotent when repeated, and requires no Node environment at migration time |

**Key insight:** The codebase already uses Drizzle migrations for all schema changes and `@radix-ui` for all interactive form primitives — both are the established path.

---

## Common Pitfalls

### Pitfall 1: Back-fill Runs After Default Already Applied
**What goes wrong:** You run `db:migrate` as soon as `drizzle-kit generate` produces the file, before adding the `UPDATE` statements. All existing researcher rows get `max_drafts_per_run = 3` and `short_form_percent = 70` from the column DEFAULT, overwriting whatever they had in JSON.
**Why it happens:** drizzle-kit's generated file only contains DDL; back-fill logic must be added manually.
**How to avoid:** Edit the generated `.sql` file to add the `UPDATE` statements before running `db:migrate`.
**Warning signs:** After migration, all researchers show 3 drafts and 70% short-form even if users had set different values.

### Pitfall 2: ResearcherForm State Mismatch
**What goes wrong:** The form component currently holds all config in a single `sourceConfig` state object. After the phase, `shortFormPercent` and `maxDraftsPerRun` are separate top-level fields. If only the UI removes them from the form but the payload still serializes them inside `sourceConfig`, the API will ignore them.
**Why it happens:** The submit payload is built from `sourceConfig` state; if two separate state vars aren't wired to the payload, they won't be sent.
**How to avoid:** Add `maxDraftsPerRun` and `shortFormPercent` as top-level `useState` vars alongside `sourceConfig` in the form; wire them into the submit payload.
**Warning signs:** Saving the form doesn't persist the slider value or max drafts change.

### Pitfall 3: ResearchConfig Type Still References Removed Fields
**What goes wrong:** After removing fields from `ResearchSourceConfig`, the old `ResearchConfig` interface (on the `channels` table's `researchConfig` column) still has `contentTypeMix`, `maxDraftsPerRun`, and `scheduleHours`. If those are also removed from `ResearchConfig`, the legacy `runResearchForChannel` function (which spreads `channel.researchConfig`) will break at runtime if any channel still has these fields in its stored JSON.
**Why it happens:** `ResearchConfig` is used by the legacy channel-based research path, which still reads from `channels.researchConfig` jsonb column.
**How to avoid:** Make `contentTypeMix`, `maxDraftsPerRun`, and `scheduleHours` optional (`?`) in `ResearchConfig` rather than deleting them outright, since `channels.researchConfig` is not migrated in this phase. Alternatively, mark the legacy path as deprecated but functional.
**Warning signs:** TypeScript errors in `runResearchForChannel` after schema cleanup.

### Pitfall 4: Test Fixtures Remain Stale
**What goes wrong:** 4 test files (`exa.test.ts`, `orchestrator.test.ts`, `reddit.test.ts`, `substack-monitor.test.ts`) have `baseConfig` objects with `contentTypeMix`, `maxDraftsPerRun`, and `scheduleHours`. After those fields become optional or are removed, the tests will still pass TypeScript (since the extra fields would be allowed in an object literal), but they represent a maintenance hazard.
**Why it happens:** The test fixtures predate the schema cleanup.
**How to avoid:** Update all `baseConfig` fixtures in the 4 test files as part of this phase to remove the migrated fields and ensure they match the new `ResearchConfig` shape.
**Warning signs:** `pnpm test` passes but fixtures contain fields that no longer exist in the schema types.

### Pitfall 5: Slider Value Convention Mismatch
**What goes wrong:** `@radix-ui/react-slider` uses `value={[N]}` (an array) for its `value` prop. If you pass `value={shortFormPercent}` (a number), TypeScript will error and the slider won't render correctly.
**Why it happens:** Radix slider supports multi-thumb (range) mode, so it always uses arrays.
**How to avoid:** Use `value={[shortFormPercent]}` and `onValueChange={([v]) => setShortFormPercent(v)}` in the form.
**Warning signs:** TypeScript prop type error when wiring up the slider.

---

## Code Examples

### PostgreSQL jsonb Key Deletion Operator
```sql
-- Source: PostgreSQL docs — jsonb - text operator removes a key
-- Removes multiple keys using repeated subtraction
UPDATE "researchers"
SET source_config = source_config
  - 'maxDraftsPerRun'
  - 'scheduleHours'
  - 'contentTypeMix';
```

### PostgreSQL jsonb Nested Value Extraction
```sql
-- Source: PostgreSQL docs — jsonb -> operator for nested access
-- contentTypeMix.note was an integer nested inside an object
(source_config->'contentTypeMix'->>'note')::integer
```

### Radix Slider Integration with shortFormPercent State
```tsx
// Pattern: Radix slider requires array value; destructure on change
const [shortFormPercent, setShortFormPercent] = useState(
  researcher?.shortFormPercent ?? 70
);

<div className="space-y-3">
  <div className="flex justify-between text-xs text-muted-foreground">
    <span>Short-form</span>
    <span>{shortFormPercent}% / {100 - shortFormPercent}%</span>
    <span>Long-form</span>
  </div>
  <Slider
    min={0}
    max={100}
    step={5}
    value={[shortFormPercent]}
    onValueChange={([v]) => setShortFormPercent(v)}
  />
  <p className="text-xs text-muted-foreground">
    Short-form keeps you visible with quick takes. Long-form builds authority with in-depth pieces.
  </p>
</div>
```

### API Route: Accept New Top-Level Fields (POST)
```typescript
// src/app/api/researchers/route.ts — POST handler after change
const [researcher] = await db
  .insert(researchers)
  .values({
    name: body.name,
    topics: body.topics ?? [],
    keywords: body.keywords ?? [],
    sourceConfig: body.sourceConfig ?? {
      subreddits: [],
      substackFeeds: [],
      searchQueryTemplates: [],
      excludedDomains: [],
    },
    maxDraftsPerRun: body.maxDraftsPerRun ?? 3,
    shortFormPercent: body.shortFormPercent ?? 70,
  })
  .returning();
```

### API Route: Accept New Top-Level Fields (PUT)
```typescript
// src/app/api/researchers/[id]/route.ts — PUT handler updates object
const updates: Record<string, unknown> = { updatedAt: new Date() };
if ('name' in body) updates.name = body.name;
if ('topics' in body) updates.topics = body.topics;
if ('keywords' in body) updates.keywords = body.keywords;
if ('sourceConfig' in body) updates.sourceConfig = body.sourceConfig;
if ('maxDraftsPerRun' in body) updates.maxDraftsPerRun = body.maxDraftsPerRun;
if ('shortFormPercent' in body) updates.shortFormPercent = body.shortFormPercent;
```

### ResearcherForm Submit Payload
```typescript
const payload = {
  name: name.trim(),
  topics,
  keywords,
  maxDraftsPerRun,
  shortFormPercent,
  sourceConfig: {
    ...sourceConfig,
    searchQueryTemplates: sourceConfig.searchQueryTemplates.filter(Boolean),
  },
  channelIds: selectedChannelIds,
};
```

---

## Complete Change Inventory

Every file that must change, and what changes:

| File | Change Type | What Changes |
|------|-------------|-------------|
| `src/db/schema.ts` | Modify | Add `maxDraftsPerRun` + `shortFormPercent` to `researchers` table; remove 3 fields from `ResearchSourceConfig`; make 3 fields optional in `ResearchConfig` |
| `src/db/migrations/0004_*.sql` | Create (generated + hand-edited) | DDL for new columns + UPDATE back-fill + jsonb key deletion |
| `src/lib/research/engine.ts` | Modify | `buildResearchConfig()` reads from top-level columns; update function signature type; remove `scheduleHours` from return value |
| `src/app/api/researchers/route.ts` | Modify | POST: remove `maxDraftsPerRun`/`scheduleHours`/`contentTypeMix` from `sourceConfig` default; add them as top-level values |
| `src/app/api/researchers/[id]/route.ts` | Modify | PUT: handle `maxDraftsPerRun` and `shortFormPercent` at top level |
| `src/components/ui/slider.tsx` | Create | shadcn Slider wrapper around `@radix-ui/react-slider` |
| `src/components/research/ResearcherForm.tsx` | Modify | Add sections; replace number inputs with slider; promote `maxDraftsPerRun` and `shortFormPercent` to top-level state; update payload |
| `src/components/channels/ResearchConfigForm.tsx` | Delete | Dead code since Phase 11 |
| `tests/lib/research/exa.test.ts` | Modify | Remove `contentTypeMix`/`maxDraftsPerRun`/`scheduleHours` from `baseConfig` fixture |
| `tests/lib/research/orchestrator.test.ts` | Modify | Same fixture cleanup |
| `tests/lib/research/reddit.test.ts` | Modify | Same fixture cleanup |
| `tests/lib/research/substack-monitor.test.ts` | Modify | Same fixture cleanup |

**Files confirmed safe (no changes needed):**
- `src/lib/research/exa.ts` — reads `config.topics`, `config.keywords`, `config.searchQueryTemplates` only
- `src/lib/research/reddit.ts` — reads `config.subreddits`, `config.keywords` only
- `src/lib/research/substack-monitor.ts` — reads `config.substackFeeds` only
- `src/lib/research/brainstorm.ts` — reads `config.topics`, `config.keywords` only
- `src/lib/research/orchestrator.ts` — passes config through to adapters, no field access
- `src/app/(app)/research/[id]/page.tsx` — passes `researcher.sourceConfig` to form; will need sourceConfig type to match after change, but no direct field access to removed fields

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All research settings in JSON blob (`sourceConfig`) | Scalar business-logic fields as typed columns, JSON only for source-specific config | Phase 12 | Enables SQL queries/filtering on `maxDraftsPerRun`; Phase 14 can reference it directly for automation overrides |
| `note` / `article` content type labels | `shortFormPercent` integer (0-100), platform-agnostic | Phase 12 | Prepares for Phase 13 publisher-declared content types |

---

## Open Questions

1. **Does `runResearchForChannel` (legacy) need to stay functional?**
   - What we know: It reads from `channels.researchConfig`, which still has `maxDraftsPerRun`, `scheduleHours`, `contentTypeMix` in its JSON. It is marked "legacy — used by CronJob" in the code.
   - What's unclear: Is the CronJob currently active? Will removing these fields from `ResearchConfig` break it at the TypeScript level?
   - Recommendation: Make `contentTypeMix`, `maxDraftsPerRun`, and `scheduleHours` optional in `ResearchConfig` (not removed) so `runResearchForChannel` compiles. The fields won't appear in new data but won't crash legacy reads. Drizzle's type-narrowing means the engine code won't emit TypeScript errors when reading optional fields.

2. **Does the `research/[id]/page.tsx` need updating beyond type changes?**
   - What we know: It passes `researcher.sourceConfig as ResearchSourceConfig` to `ResearcherForm`. After cleanup, `ResearcherForm` needs `maxDraftsPerRun` and `shortFormPercent` as separate props or the researcher object must include them.
   - What's unclear: Whether the page fetches the full researcher row (yes — it does a full `db.select()`) so `researcher.maxDraftsPerRun` and `researcher.shortFormPercent` will be available after the schema change.
   - Recommendation: Update the `ResearcherForm` props interface to accept `maxDraftsPerRun` and `shortFormPercent` directly from the researcher object; update the page to pass them.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `src/db/schema.ts`, `src/lib/research/engine.ts`, `src/components/research/ResearcherForm.tsx`, `src/app/api/researchers/route.ts`, `src/app/api/researchers/[id]/route.ts`, all test fixtures
- PostgreSQL jsonb operator documentation (established SQL syntax, no version concerns)
- Drizzle ORM patterns observed in `src/db/migrations/0003_regular_karma.sql`

### Secondary (MEDIUM confidence)
- `@radix-ui/react-slider` API (value prop array convention) — inferred from installed @radix-ui packages' consistent API patterns; not installed yet so exact prop names not directly verified from source
- shadcn/ui Slider component pattern — inferred from existing `button.tsx`, `input.tsx`, `label.tsx` component shapes in `src/components/ui/`

### Tertiary (LOW confidence)
- None — all findings are based on direct code inspection

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools already in use except `@radix-ui/react-slider` which is the obvious choice given existing @radix-ui usage
- Architecture: HIGH — all integration points verified by direct code inspection; change inventory is exhaustive
- Pitfalls: HIGH — identified from direct code reading; no speculation

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable internal refactoring, no external API dependencies)
