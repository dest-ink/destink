# Phase 13: Draft Generation - Research

**Researched:** 2026-03-03
**Domain:** Draft generation engine, SSE streaming extension, Drizzle schema migration, Next.js App Router API routes
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Generation Feedback
- SSE streaming log for draft generation progress, reusing the existing research SSE pattern
- Per-draft events in the stream: "generating draft 1/3: [Topic Title]... done"
- Stay on page with success summary after completion ("3 drafts created") plus link to drafts page
- Partial failures: continue generating remaining drafts, show failures inline in the log (red like research errors). Summary shows "2/3 drafts created, 1 failed". No retry UI -- user can click Generate again.

#### Topic Selection
- Auto-select top N topics by relevanceScore (N = maxDraftsPerRun). No user picking.
- Skip topics that already have a draft for the same channel (title dedup). Move to next topic if skipped.
- Multi-channel researchers: same top topics, one draft per channel. Researcher linked to 2 channels with maxDraftsPerRun=3 creates 6 total drafts (3 per channel), each using that channel's persona/voice.
- Disable "Generate Drafts" button after drafts already generated for a run. Show "Drafts Generated (3)" badge instead. To generate more, run research again.

#### Content Type Assignment
- shortFormPercent overrides the AI's per-topic contentType suggestion. Deterministic ratio applied to the batch.
- Rounding: round to nearest, favor short-form on ties. (70% of 3 = 2 notes + 1 article. 50% of 3 = 2 notes + 1 article.)
- Keep existing generation prompt spec -- notes are 150-300 words punchy, articles are 800-2000 words structured. No changes to generator.ts prompts.
- Plain text output for both notes and articles. No HTML articles yet -- that's a publisher concern for later.

#### Auto-Draft Control
- Add `autoDraft` boolean column to researchers table (default: false)
- When true, drafts auto-generate immediately after any research run completes for that researcher
- Toggle lives in the "Draft Settings" section of ResearcherForm (alongside short-form slider and maxDraftsPerRun)
- Auto-draft extends the research SSE stream -- after "run-complete" event, draft generation events continue in the same stream
- Draft generation failures do NOT affect research run status. Run is always saved successfully. User can manually click Generate Drafts to retry.

### Claude's Discretion
- Generate Drafts button placement (research run detail view vs runs list -- pick based on existing page structure)
- SSE event type naming for draft generation events
- Exact dedup matching logic (title-based or topic-based)
- Migration approach for new autoDraft column
- How to assign content types to specific topics within the batch (e.g., highest relevance topics get which type)

### Deferred Ideas (OUT OF SCOPE)
- HTML output for article content type -- publisher concern, not generation concern
- Publisher content type declarations (short-form max chars, long-form HTML mapper) -- Phase 14+
- Per-schedule automation overrides for maxDraftsPerRun and autoDraft -- Phase 14
- Topic preview/selection UI before generating -- could be a future enhancement
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DRAFT-01 | User can click "Generate Drafts" on a research run to create drafts from the top-ranked topics | New `GenerateDraftsButton` client component on RunDetail page; calls new `POST /api/researchers/[id]/runs/[runId]/generate-drafts` SSE endpoint |
| DRAFT-02 | Research engine auto-generates drafts after a run completes, respecting maxDraftsPerRun setting | `autoDraft` column on researchers; `runResearchForResearcher()` calls `generateDraftsForRun()` after persisting run; events flow through existing SSE stream |
| DRAFT-03 | Draft generation uses contentTypeMix (note vs article ratio) to determine content types | `assignContentTypes()` utility: sort topics by relevanceScore, apply shortFormPercent ratio deterministically, favor short-form on ties |
| DRAFT-04 | Drafts are only created for channels linked to the researcher | Batch engine receives channelId as parameter; already loops per channel in research engine; draft generation follows same loop |
| DRAFT-05 | The draftsGenerated field on research runs is populated with generated draft IDs | After generating all drafts, `db.update(researchRuns).set({ draftsGenerated: [...ids] })` where draftsGenerated jsonb column already exists in schema |
| DRAFT-06 | All generated drafts are created with pending_review status (approval always required) | `status: 'pending_review'` in draft insert -- matches existing default but must be explicit; verified in POST /api/drafts pattern |
</phase_requirements>

## Summary

Phase 13 builds the draft generation engine on top of the existing research infrastructure. The core technical work involves three layers: (1) a new `generateDraftsForRun()` function in `src/lib/generation/` that orchestrates batch draft creation from a completed research run, (2) extending the SSE event types and `runResearchForResearcher()` to emit draft progress events and optionally trigger auto-draft, and (3) a new API endpoint `POST /api/researchers/[id]/runs/[runId]/generate-drafts` plus UI components for the manual trigger button and "Drafts Generated" badge.

The existing codebase provides all the building blocks: `generateDraft()` in `generator.ts` handles single-draft Claude calls, `researchRuns.draftsGenerated` is a pre-existing jsonb column ready to populate, and `ResearchRunPanel.tsx` demonstrates the full SSE streaming client pattern. The schema only needs one new column (`autoDraft boolean` on researchers) and one new Drizzle migration. The content type ratio logic requires a deterministic algorithm: sort topics by `relevanceScore` descending, compute how many notes vs articles to create from `shortFormPercent`, assign `note` to the top-N slots and `article` to the rest.

The most architecturally significant decision is that auto-draft extends the existing SSE stream seamlessly -- no second request, no restart. The run route already closes the stream after `run-complete`. This must change: when `autoDraft` is true, the run route continues emitting draft events before closing. The `ResearchRunPanel` client must handle the new event types. The "Generate Drafts" button lives on the run detail page (`/research/[id]/runs/[runId]`) because that's where the run data and topics are already rendered -- this is the natural placement.

**Primary recommendation:** Build a `generateDraftsForRun()` engine function first (pure logic, no UI), then wire it into the SSE run route for auto-draft, then add the manual API endpoint and UI button.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.1 | DB queries, schema updates | Already the project ORM |
| drizzle-kit | ^0.31.9 | Migration generation (`db:generate`, `db:migrate`) | Established migration pattern from Phases 12, 11 |
| @anthropic-ai/sdk | ^0.78.0 | Claude API calls via `callClaude()` | All AI calls use this via `src/lib/ai/client.ts` |
| next (App Router) | 16.1.6 | SSE via `ReadableStream` + `Response`, API routes | Existing infrastructure |
| react | 19.2.3 | Client components for button state, SSE event handling | All UI |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| randomUUID (node:crypto) | built-in | Generate draft IDs before insert | Same pattern as `POST /api/drafts` |
| lucide-react | ^0.575.0 | Icons for button states (loading spinner, checkmark) | All icons in project |
| sonner | ^2.0.7 | Toast notifications | Already used in ResearcherForm |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending SSE stream for auto-draft | Separate webhook/polling after run | SSE extension keeps UX seamless, matches user decision |
| Title-based dedup | Topic ID-based dedup | Topics have no stable ID; title string match is sufficient and matches user intent |
| New batch API endpoint | Reusing `POST /api/drafts` in a loop from client | Server-side batch avoids N parallel client requests, enables SSE progress |

**Installation:**
No new packages needed. All dependencies already present.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/generation/
│   ├── generator.ts          # existing -- generateDraft() unchanged
│   └── batch.ts              # NEW -- generateDraftsForRun() engine function
├── lib/research/
│   ├── engine.ts             # MODIFIED -- autoDraft hook after run-complete
│   └── progress.ts           # MODIFIED -- add draft progress event types
├── app/api/researchers/[id]/
│   ├── run/route.ts          # MODIFIED -- pass autoDraft flag, handle draft events
│   └── runs/[runId]/
│       └── generate-drafts/
│           └── route.ts      # NEW -- manual trigger SSE endpoint
├── app/(app)/research/[id]/runs/[runId]/
│   └── page.tsx              # MODIFIED -- pass draftsGenerated + autoDraft to RunDetail
├── components/research/
│   ├── RunDetail.tsx         # MODIFIED -- add GenerateDraftsButton + badge
│   └── ResearchRunPanel.tsx  # MODIFIED -- handle draft progress events
└── components/research/
    └── ResearcherForm.tsx    # MODIFIED -- add autoDraft toggle to Draft Settings section
```

### Pattern 1: Batch Draft Generation Engine Function
**What:** Pure orchestration function in `src/lib/generation/batch.ts` that takes a run's topics, channel context, and settings, generates drafts one-by-one, updates the run record, and returns results.
**When to use:** Called by both (a) the auto-draft path in `engine.ts` and (b) the manual-trigger API route.

```typescript
// src/lib/generation/batch.ts
import { db } from '@/db/client';
import { drafts, researchRuns, channels, voiceProfiles } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { generateDraft } from './generator';
import { randomUUID } from 'crypto';
import type { TopicRecommendation, ResearchSource } from '@/db/schema';
import type { OnDraftProgress } from './batch-progress';

export interface DraftBatchResult {
  generatedIds: string[];
  failedCount: number;
}

/**
 * Assigns content types to a batch of topics based on shortFormPercent.
 * Sorts topics by relevanceScore descending, assigns note/article deterministically.
 * Favors short-form on ties (e.g., 50% of 3 → 2 notes, 1 article).
 */
export function assignContentTypes(
  topics: TopicRecommendation[],
  count: number,
  shortFormPercent: number,
): Array<{ topic: TopicRecommendation; contentType: 'note' | 'article' }> {
  const sorted = [...topics]
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, count);

  // Math.round favors short-form on ties (0.5 rounds to 1)
  const noteCount = Math.round((shortFormPercent / 100) * sorted.length);

  return sorted.map((topic, i) => ({
    topic,
    contentType: i < noteCount ? 'note' : 'article',
  }));
}

/**
 * Generates drafts for a completed research run.
 * Called by auto-draft (engine.ts) and manual trigger (API route).
 * Updates researchRuns.draftsGenerated on completion.
 */
export async function generateDraftsForRun(
  runId: string,
  channelId: string,
  topics: TopicRecommendation[],
  maxDraftsPerRun: number,
  shortFormPercent: number,
  onProgress?: OnDraftProgress,
): Promise<DraftBatchResult> {
  // Load channel for persona prompt
  const [channel] = await db.select().from(channels).where(eq(channels.id, channelId));
  if (!channel) throw new Error(`Channel ${channelId} not found`);

  // Load recent draft titles for context (dedup + recency)
  const recentDrafts = await db
    .select({ title: drafts.title })
    .from(drafts)
    .where(eq(drafts.channelId, channelId))
    .orderBy(desc(drafts.createdAt))
    .limit(10);
  const recentTitles = recentDrafts.map((d) => d.title ?? '').filter(Boolean);

  // Dedup: skip topics that already have a draft with the same title for this channel
  const existingTitles = new Set(recentTitles.map((t) => t.toLowerCase()));

  // Assign content types deterministically
  const assignments = assignContentTypes(topics, maxDraftsPerRun, shortFormPercent);

  const generatedIds: string[] = [];
  let failedCount = 0;
  let index = 0;

  for (const { topic, contentType } of assignments) {
    // Skip if title already exists for this channel
    if (existingTitles.has(topic.title.toLowerCase())) {
      onProgress?.({ type: 'draft-skipped', title: topic.title, reason: 'duplicate' });
      continue;
    }

    index++;
    onProgress?.({ type: 'draft-start', index, total: assignments.length, title: topic.title });

    const draftId = randomUUID();
    try {
      const generated = await generateDraft(
        {
          contentType,
          personaPrompt: channel.personaPrompt ?? '',
          topicTitle: topic.title,
          topicAngle: topic.angle,
          sources: topic.sources as ResearchSource[],
          recentTitles,
        },
        channelId,
        draftId,
      );

      await db.insert(drafts).values({
        id: draftId,
        channelId,
        researchRunId: runId,
        contentType,
        title: generated.headlineOptions[0] ?? null,
        headlineOptions: generated.headlineOptions,
        hook: generated.hook,
        body: generated.body,
        cta: generated.cta,
        voiceConfidence: generated.voiceConfidence,
        researchSources: topic.sources as ResearchSource[],
        aiModel: 'claude-sonnet-4-6',
        status: 'pending_review',
      });

      generatedIds.push(draftId);
      onProgress?.({ type: 'draft-complete', index, total: assignments.length, title: topic.title, draftId });
    } catch (err) {
      failedCount++;
      const error = err instanceof Error ? err.message : String(err);
      onProgress?.({ type: 'draft-error', index, total: assignments.length, title: topic.title, error });
    }
  }

  // Populate draftsGenerated on the research run
  if (generatedIds.length > 0) {
    await db
      .update(researchRuns)
      .set({ draftsGenerated: generatedIds })
      .where(eq(researchRuns.id, runId));
  }

  return { generatedIds, failedCount };
}
```

### Pattern 2: Extended Progress Event Types
**What:** Add draft generation event types to `progress.ts` so both the research SSE stream and the manual-trigger stream use the same event discriminated union.
**When to use:** Always -- typed events prevent runtime shape mismatches between server and client.

```typescript
// src/lib/research/progress.ts (extended)
export type ResearchProgressEvent =
  | { type: 'adapter-start'; adapterId: string; adapterName: string }
  | { type: 'adapter-result'; adapterId: string; adapterName: string; sourceCount: number }
  | { type: 'adapter-error'; adapterId: string; adapterName: string; error: string }
  | { type: 'topic-ranking'; topicCount: number }
  | { type: 'run-complete'; runId: string; topicCount: number; sourceCount: number }
  | { type: 'run-error'; error: string }
  // Draft generation events (new in Phase 13):
  | { type: 'draft-start'; index: number; total: number; title: string }
  | { type: 'draft-complete'; index: number; total: number; title: string; draftId: string }
  | { type: 'draft-error'; index: number; total: number; title: string; error: string }
  | { type: 'draft-skipped'; title: string; reason: string }
  | { type: 'drafts-done'; generated: number; failed: number; draftIds: string[] };

export type OnProgress = (event: ResearchProgressEvent) => void;
```

### Pattern 3: Auto-Draft Hook in engine.ts
**What:** After persisting each research run, check `researcher.autoDraft` flag and call `generateDraftsForRun()` if true. Failures are caught and logged but do not affect run status.
**When to use:** Only in `runResearchForResearcher()`. The legacy `runResearchForChannel()` does not get this hook.

```typescript
// In runResearchForResearcher(), after the run-complete event:
if (researcher.autoDraft) {
  try {
    const topics = run.topicsFound as TopicRecommendation[] ?? [];
    await generateDraftsForRun(
      run.id,
      channel.id,
      topics,
      researcher.maxDraftsPerRun,
      researcher.shortFormPercent,
      onProgress,
    );
  } catch (err) {
    // Failures logged, not re-thrown -- run is already saved
    onProgress?.({ type: 'run-error', error: `Draft generation failed: ${err instanceof Error ? err.message : String(err)}` });
  }
}
```

### Pattern 4: Manual Trigger SSE Endpoint
**What:** `POST /api/researchers/[id]/runs/[runId]/generate-drafts` returns a `text/event-stream` response. Loads the run from DB, calls `generateDraftsForRun()`, emits events.
**When to use:** Manual "Generate Drafts" button click.

```typescript
// src/app/api/researchers/[id]/runs/[runId]/generate-drafts/route.ts
export const POST = auth(function POST(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    const { id, runId } = await (ctx?.params as Promise<{ id: string; runId: string }>);

    // Load researcher for settings
    const [researcher] = await db.select().from(researchers).where(eq(researchers.id, id));
    if (!researcher) return NextResponse.json({ error: 'Researcher not found' }, { status: 404 });

    // Load run and verify it belongs to this researcher
    const [run] = await db
      .select()
      .from(researchRuns)
      .where(and(eq(researchRuns.id, runId), eq(researchRuns.researcherId, id)));
    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });

    // Guard: don't regenerate if drafts already exist for this run
    const existingDrafts = run.draftsGenerated as string[] | null;
    if (existingDrafts && existingDrafts.length > 0) {
      return NextResponse.json(
        { error: 'Drafts already generated for this run' },
        { status: 409 }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        function send(event: ResearchProgressEvent) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }

        const topics = run.topicsFound as TopicRecommendation[] ?? [];
        generateDraftsForRun(
          run.id,
          run.channelId,
          topics,
          researcher.maxDraftsPerRun,
          researcher.shortFormPercent,
          send,
        )
          .then(({ generatedIds, failedCount }) => {
            send({ type: 'drafts-done', generated: generatedIds.length, failed: failedCount, draftIds: generatedIds });
            controller.close();
          })
          .catch((err) => {
            send({ type: 'run-error', error: err instanceof Error ? err.message : String(err) });
            controller.close();
          });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  })();
});
```

### Pattern 5: Generate Drafts Button Component
**What:** Client component on the run detail page. Shows button when `draftsGenerated` is empty/null; shows badge once drafts exist. Streams events into a log.
**When to use:** Embedded in `RunDetail.tsx` -- the run detail page already has the topics list, making it the natural home for this control.

```typescript
// Placement in RunDetail.tsx -- add to the summary card row
// Props needed by RunDetail: draftsGenerated: string[] | null, researcherId: string

// GenerateDraftsButton receives: runId, researcherId, initialDraftsGenerated
// Renders: Button (if no drafts) or Badge "Drafts Generated (N)" + link to /drafts
```

### Pattern 6: Drizzle Schema Migration for autoDraft
**What:** Add boolean column with default false to researchers table. Generate migration with `pnpm db:generate`, apply with `pnpm db:migrate`.
**When to use:** First task in Phase 13 -- schema before code.

```sql
-- Migration generated by drizzle-kit:
ALTER TABLE "researchers" ADD COLUMN "auto_draft" boolean DEFAULT false NOT NULL;
```

```typescript
// In schema.ts researchers table:
autoDraft: boolean('auto_draft').default(false).notNull(),
```

### Anti-Patterns to Avoid
- **Calling generateDraft() from the client:** All draft generation must be server-side. The API key is only on the server; client-side calls would expose it.
- **Mutating `topicsFound` array:** `assignContentTypes()` should sort a copy (`[...topics]`), not the original.
- **Ignoring the dedup window:** The `existingTitles` set should be built from DB state at generation time, not from `recentTitles` passed to the generator (those are the 10 most recent; dedup needs all titles for this channel or at minimum recent ones).
- **Failing the entire batch on one error:** Each draft generation is independently try/caught. One Claude API timeout must not prevent the remaining drafts from generating.
- **Setting `draftsGenerated` after each draft:** Write once after the full batch -- reduces DB round trips and ensures atomicity of the count the user sees.
- **Re-generating if drafts already exist:** The manual endpoint returns 409 if `draftsGenerated` is already populated. The button should be disabled in the UI as well (double protection).
- **Using `router.refresh()` to show the badge:** After SSE completion, the page needs fresh data. `router.refresh()` in Next.js App Router invalidates the server component cache and re-fetches -- use this rather than navigating away and back.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Streaming draft progress to client | Custom polling or websocket | ReadableStream SSE (same as research run) | Already fully established in the codebase |
| Draft creation DB logic | Custom insert helpers | Direct Drizzle insert (same as POST /api/drafts) | Pattern already tested and consistent |
| Content type ratio math | Floating point split | `Math.round((percent/100) * count)` with favor-short-form tie-breaking | Simple, deterministic, no library needed |
| Migration generation | Hand-writing SQL | `pnpm db:generate` then `pnpm db:migrate` | Drizzle-kit generates correct SQL from schema diff |

**Key insight:** Every primitive needed already exists -- the only new logic is the orchestration layer that connects them in batch.

## Common Pitfalls

### Pitfall 1: SSE Stream Closed Before Auto-Draft Events
**What goes wrong:** `run/route.ts` currently calls `controller.close()` immediately after `runResearchForResearcher()` resolves. If auto-draft is added inside `runResearchForResearcher()`, the stream stays open during draft generation -- but the client `ResearchRunPanel` may consider the run "done" (setRunning(false)) on `run-complete` and stop rendering new events.
**Why it happens:** The client's `finally` block sets `running = false` when the reader is done (stream closes), not when it sees `run-complete`. But UI feedback ("Run complete") is emitted before draft events start.
**How to avoid:** In `ResearchRunPanel`, change state management so `run-complete` transitions to a "drafting" phase (not fully stopped), and only `drafts-done` (or stream close) sets `running = false`.
**Warning signs:** "Run complete" log line appears but no draft events follow -- user thinks it's done when drafting is still happening.

### Pitfall 2: Multi-Channel Run Writes draftsGenerated Incorrectly
**What goes wrong:** `runResearchForResearcher()` loops over multiple channels, creating one research run per channel. Each run gets its own `runId`. If `generateDraftsForRun()` is called for each channel inside the loop, each run gets its own `draftsGenerated` array correctly. But if the loop aggregates IDs and only writes once, it writes the wrong run's IDs.
**Why it happens:** The per-channel loop in `engine.ts` is subtle -- the `run` variable is scoped to each iteration but easy to accidentally close over.
**How to avoid:** Call `generateDraftsForRun(run.id, channel.id, ...)` inside the loop body, immediately after each `run-complete` event. Never aggregate across channels.
**Warning signs:** One run shows all draft IDs, another shows none.

### Pitfall 3: dedup Lookup Uses Stale Data
**What goes wrong:** `recentTitles` is fetched at the start of `generateDraftsForRun()` but drafts are inserted one-by-one in a loop. If topics 1 and 3 have similar titles, topic 3's dedup check won't see topic 1's newly inserted draft because `existingTitles` was built before the loop.
**Why it happens:** Set built once from DB, then loop proceeds without refreshing.
**How to avoid:** Add each newly generated title to `existingTitles` set after successful insert:
```typescript
generatedIds.push(draftId);
existingTitles.add(topic.title.toLowerCase()); // prevent intra-batch dupes
```
**Warning signs:** Two drafts with nearly identical titles from the same run.

### Pitfall 4: RunDetail Page Uses `force-dynamic` but Doesn't Reflect New draftsGenerated
**What goes wrong:** The run detail page (`/research/[id]/runs/[runId]/page.tsx`) uses `export const dynamic = 'force-dynamic'`. After manual draft generation, the page still shows the old `draftsGenerated: null` because the server component was rendered before generation.
**Why it happens:** `force-dynamic` means no caching, but the component rendered when the page loaded -- it doesn't auto-refresh after client-side actions.
**How to avoid:** After the SSE stream closes (drafts-done event), call `router.refresh()` in the client component to re-request the page from the server with fresh DB data.
**Warning signs:** User generates drafts, stream shows success, but "Drafts Generated (3)" badge doesn't appear until manual page reload.

### Pitfall 5: researcher.autoDraft Not Loaded in run/route.ts
**What goes wrong:** `run/route.ts` currently only selects `{ id: researchers.id }` to verify the researcher exists. It doesn't load `autoDraft`. The engine function receives no `autoDraft` signal.
**Why it happens:** Minimal select pattern (only what's needed) is correct normally, but Phase 13 needs more columns.
**How to avoid:** Change the researcher select in `run/route.ts` to include `autoDraft: researchers.autoDraft`, or rely on `runResearchForResearcher()` to load the researcher internally (which it already does -- see engine.ts line 101-105).
**Warning signs:** Auto-draft never fires even when the toggle is enabled.

### Pitfall 6: ResearcherForm Sends autoDraft to PUT /api/researchers Without Server-Side Handling
**What goes wrong:** `ResearcherForm` sends the payload to `PUT /api/researchers/[id]`. The route handler's update logic uses `if ('name' in body) updates.name = ...` guards. If `autoDraft` is added to the form payload but not added to the handler's guard list, it silently drops.
**Why it happens:** The PUT handler enumerates known fields -- new fields must be explicitly listed.
**How to avoid:** Add `if ('autoDraft' in body) updates.autoDraft = body.autoDraft;` to the PUT handler.
**Warning signs:** Toggle saves without error but autoDraft never changes in DB.

## Code Examples

### assignContentTypes() - Deterministic Ratio
```typescript
// Pure function -- no I/O
// 70% of 3 topics: Math.round(0.7 * 3) = Math.round(2.1) = 2 notes, 1 article
// 50% of 3 topics: Math.round(0.5 * 3) = Math.round(1.5) = 2 notes, 1 article (favors short-form)
// 50% of 4 topics: Math.round(0.5 * 4) = Math.round(2.0) = 2 notes, 2 articles
export function assignContentTypes(
  topics: TopicRecommendation[],
  count: number,
  shortFormPercent: number,
): Array<{ topic: TopicRecommendation; contentType: 'note' | 'article' }> {
  const sorted = [...topics]
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, count);
  const noteCount = Math.round((shortFormPercent / 100) * sorted.length);
  return sorted.map((topic, i) => ({
    topic,
    contentType: i < noteCount ? 'note' : 'article',
  }));
}
```

### Drizzle: Update draftsGenerated on research run
```typescript
// Source: existing pattern in engine.ts for .update().set().where()
await db
  .update(researchRuns)
  .set({ draftsGenerated: generatedIds })
  .where(eq(researchRuns.id, runId));
```

### Client: Handle draft events in ResearchRunPanel
```typescript
// Extends existing handleEvent() switch in ResearchRunPanel.tsx
case 'draft-start':
  addLine(
    `Generating draft ${event.index}/${event.total}: ${event.title}...`,
    'text-blue-500',
  );
  break;
case 'draft-complete':
  addLine(
    `Draft ${event.index}/${event.total} created: ${event.title}`,
    'text-green-500',
  );
  break;
case 'draft-error':
  addLine(
    `Draft ${event.index}/${event.total} failed: ${event.error}`,
    'text-destructive',
  );
  break;
case 'draft-skipped':
  addLine(
    `Skipped: ${event.title} (${event.reason})`,
    'text-muted-foreground',
  );
  break;
case 'drafts-done':
  addLine(
    `${event.generated}/${event.generated + event.failed} drafts created`,
    event.failed > 0 ? 'text-yellow-500' : 'text-green-500',
  );
  break;
```

### autoDraft Toggle in ResearcherForm Draft Settings section
```typescript
// Add below maxDraftsPerRun input in Section 3: Draft Settings
<div className="flex items-center gap-3">
  <input
    id="auto-draft"
    type="checkbox"
    checked={autoDraft}
    onChange={(e) => setAutoDraft(e.target.checked)}
    className="h-4 w-4 rounded border-border"
  />
  <Label htmlFor="auto-draft" className="text-sm font-medium cursor-pointer">
    Auto-generate drafts after each run
  </Label>
</div>
```

### "Drafts Generated" badge + Generate button logic
```typescript
// In GenerateDraftsButton (client component):
// Props: runId, researcherId, initialDraftsGenerated: string[] | null
const hasDrafts = draftsGenerated && draftsGenerated.length > 0;

if (hasDrafts) {
  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="text-green-600 border-green-500/20 bg-green-500/10">
        Drafts Generated ({draftsGenerated.length})
      </Badge>
      <Link href="/drafts" className="text-xs text-primary hover:underline">
        View drafts
      </Link>
    </div>
  );
}

return (
  <Button onClick={handleGenerate} disabled={running} size="sm" variant="outline">
    {running ? 'Generating...' : 'Generate Drafts'}
  </Button>
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| contentTypeMix JSON object (note%, article%) | shortFormPercent integer (0-100) | Phase 12 | Simpler; Phase 13 uses this single integer |
| scheduleHours in sourceConfig | Removed; Phase 14 handles scheduling | Phase 12 | draft generation is not scheduled; that's Phase 14 |
| Drafts created via POST /api/drafts (one at a time) | Batch engine in src/lib/generation/batch.ts | Phase 13 (new) | Server-side loop with SSE progress |

**Deprecated/outdated:**
- `contentTypeMix` on ResearchConfig: fields now optional for backward compat with legacy channels.researchConfig; not used by Phase 13 draft engine
- `runResearchForChannel()`: legacy function for old cron path; does not get auto-draft support

## Open Questions

1. **Where exactly to display the "Generate Drafts" button: run detail page or runs list?**
   - What we know: RunDetail page (`/research/[id]/runs/[runId]`) already renders the full topic list and run metadata. The runs list page only shows summary rows with links.
   - What's unclear: User preference marked as Claude's discretion.
   - Recommendation: Place on the run detail page. The user needs to see the topics before generating, and the detail page is the natural context. The runs list can show the "Drafts Generated (N)" badge as a read-only indicator.

2. **Dedup: title-based string match or something else?**
   - What we know: `TopicRecommendation` has no stable ID. The user decision says "title dedup."
   - What's unclear: Case sensitivity, trimming, fuzzy matching.
   - Recommendation: Case-insensitive exact match (`title.toLowerCase()`). Fuzzy matching is over-engineering for v1.2.

3. **How to assign content types to the batch: highest relevance gets which type?**
   - What we know: shortFormPercent determines the count of each type. User decision says Claude's discretion on assignment within batch.
   - Recommendation: Assign `note` to the top-ranked topics (highest relevanceScore) and `article` to lower-ranked. Rationale: notes are quicker to consume and validate voice; reserve the longer article slots for topics the AI deemed less relevant but still worth covering. This biases the high-confidence topics toward short-form and exploratory topics toward long-form.

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `src/lib/research/engine.ts` -- `runResearchForResearcher()` structure, progress event emission
- Direct code inspection: `src/lib/generation/generator.ts` -- `generateDraft()` signature and return type
- Direct code inspection: `src/app/api/researchers/[id]/run/route.ts` -- SSE ReadableStream pattern
- Direct code inspection: `src/db/schema.ts` -- `researchRuns.draftsGenerated` jsonb column, `researchers` table columns
- Direct code inspection: `src/components/research/ResearchRunPanel.tsx` -- full client SSE handling pattern
- Direct code inspection: `src/components/research/RunDetail.tsx` -- existing run detail render
- Direct code inspection: `src/app/api/drafts/route.ts` -- single draft creation pattern, pending_review default
- Direct code inspection: `src/lib/research/progress.ts` -- existing event type union
- Direct code inspection: `src/db/migrations/0004_early_dreaming_celestial.sql` -- Phase 12 migration pattern
- Direct code inspection: `src/components/research/ResearcherForm.tsx` -- Draft Settings section structure

### Secondary (MEDIUM confidence)
- Next.js App Router dynamic params pattern: `await (ctx?.params as Promise<{ id: string; runId: string }>)` -- verified against existing route.ts files in codebase

### Tertiary (LOW confidence)
- None -- all findings come from direct codebase inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all dependencies are already installed; no new libraries needed
- Architecture: HIGH -- patterns directly derived from existing working code in the repo
- Pitfalls: HIGH -- identified from reading actual code paths that will be extended
- Content type ratio math: HIGH -- pure arithmetic, no external dependencies

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable -- no fast-moving external dependencies for this phase)
