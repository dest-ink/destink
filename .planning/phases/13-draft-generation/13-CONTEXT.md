# Phase 13: Draft Generation - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Research runs can produce drafts -- either automatically after a run completes or manually via a button -- respecting channel links and content type settings. This phase builds the draft generation engine, wires it into the research pipeline, and adds manual trigger UI. No automation scheduling (Phase 14) or background workers (Phase 15).

</domain>

<decisions>
## Implementation Decisions

### Generation Feedback
- SSE streaming log for draft generation progress, reusing the existing research SSE pattern
- Per-draft events in the stream: "generating draft 1/3: [Topic Title]... done"
- Stay on page with success summary after completion ("3 drafts created") plus link to drafts page
- Partial failures: continue generating remaining drafts, show failures inline in the log (red like research errors). Summary shows "2/3 drafts created, 1 failed". No retry UI -- user can click Generate again.

### Topic Selection
- Auto-select top N topics by relevanceScore (N = maxDraftsPerRun). No user picking.
- Skip topics that already have a draft for the same channel (title dedup). Move to next topic if skipped.
- Multi-channel researchers: same top topics, one draft per channel. Researcher linked to 2 channels with maxDraftsPerRun=3 creates 6 total drafts (3 per channel), each using that channel's persona/voice.
- Disable "Generate Drafts" button after drafts already generated for a run. Show "Drafts Generated (3)" badge instead. To generate more, run research again.

### Content Type Assignment
- shortFormPercent overrides the AI's per-topic contentType suggestion. Deterministic ratio applied to the batch.
- Rounding: round to nearest, favor short-form on ties. (70% of 3 = 2 notes + 1 article. 50% of 3 = 2 notes + 1 article.)
- Keep existing generation prompt spec -- notes are 150-300 words punchy, articles are 800-2000 words structured. No changes to generator.ts prompts.
- Plain text output for both notes and articles. No HTML articles yet -- that's a publisher concern for later.

### Auto-Draft Control
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

</decisions>

<specifics>
## Specific Ideas

- The research SSE stream should feel like a single pipeline when auto-draft is enabled: research events flow into draft generation events seamlessly, no gap or restart
- "Drafts Generated (3)" badge replaces the button -- communicates that this run's drafts are done without needing to navigate away
- Phase 14 will build per-schedule automation overrides on top of the researcher-level autoDraft toggle

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `generateDraft()` in `src/lib/generation/generator.ts`: Generates a single draft from a topic via Claude. Returns headlineOptions, hook, body, cta, voiceConfidence. Callers persist to DB.
- `POST /api/drafts` route: Creates one draft at a time. Can be refactored or bypassed by the batch engine.
- SSE streaming in `POST /api/researchers/[id]/run`: Existing pattern for research progress events. Same infrastructure can emit draft generation events.
- `ResearcherForm.tsx`: Already has "Draft Settings" section (short-form slider, maxDraftsPerRun) from Phase 12. New autoDraft toggle goes here.
- `Slider` component at `src/components/ui/slider.tsx`: Created in Phase 12, shadcn-style wrapper.

### Established Patterns
- Research engine (`src/lib/research/engine.ts`): `runResearchForResearcher()` runs per linked channel, uses `buildResearchConfig()` with researcher's top-level columns. Draft generation hooks in after `run-complete`.
- JSON columns: `researchRuns.draftsGenerated` is `jsonb('drafts_generated').$type<string[]>()` -- already exists, just needs populating.
- `TopicRecommendation` type: Has `title`, `angle`, `relevanceScore`, `contentType`, `sources` -- all needed for draft generation input.
- Drizzle SQL migrations for schema changes (used in Phase 12 for maxDraftsPerRun, shortFormPercent).

### Integration Points
- `src/db/schema.ts`: Add `autoDraft` boolean column to researchers table
- `src/lib/research/engine.ts`: After persisting research run, check autoDraft flag, call draft generation engine
- `src/lib/generation/generator.ts`: Existing `generateDraft()` called in a loop for batch generation
- `src/app/api/researchers/[id]/run/route.ts`: SSE endpoint needs to emit draft generation events after research events
- `src/app/(app)/research/[id]/runs/`: UI for Generate Drafts button and draftsGenerated badge
- `src/components/research/ResearcherForm.tsx`: Add autoDraft toggle to Draft Settings section

</code_context>

<deferred>
## Deferred Ideas

- HTML output for article content type -- publisher concern, not generation concern
- Publisher content type declarations (short-form max chars, long-form HTML mapper) -- Phase 14+
- Per-schedule automation overrides for maxDraftsPerRun and autoDraft -- Phase 14
- Topic preview/selection UI before generating -- could be a future enhancement

</deferred>

---

*Phase: 13-draft-generation*
*Context gathered: 2026-03-03*
