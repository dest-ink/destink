# Phase 12: Config Cleanup - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Reorganize config fields so draft generation and automation settings live in the right place with clear labels. Move `maxDraftsPerRun` and `contentTypeMix` out of the researcher's `sourceConfig` JSON into top-level columns. Remove `scheduleHours` entirely (replaced by automation config in Phase 14). Relabel content type mix as "Short-form vs Long-form %" with helper text. Delete dead code from Phase 11 cleanup. No new capabilities — just moving, renaming, removing, and regrouping fields.

</domain>

<decisions>
## Implementation Decisions

### Field Relocation
- `maxDraftsPerRun` becomes a top-level integer column on the `researchers` table (not JSON)
- `contentTypeMix` becomes a `shortFormPercent` top-level integer column on the `researchers` table (0-100, default 70)
- `scheduleHours` is removed entirely — no new home, Phase 14's automation config replaces it
- `sourceConfig` keeps its current name — after cleanup it contains only research source fields (subreddits, feeds, queries, exclusions)
- Phase 14 automation schedules will be able to override `maxDraftsPerRun` per schedule (per AUTO-03), so the researcher-level value acts as the default

### Content Type Model
- Two generic content types: **short-form** and **long-form** (platform-agnostic)
- Publisher modules will declare what content types they support plus constraints (short-form max chars, long-form HTML mapper) — this is Phase 13 work
- For Phase 12: just move the field to `shortFormPercent` column with a slider UI. The publisher content type interface comes later.
- Article writing UI will always output HTML; publisher adapters convert HTML to platform-native format — this is also Phase 13+ work

### Short-form vs Long-form UX
- Replace the bare "Note %" number input with a slider
- Slider: left side labeled "Short-form", right side labeled "Long-form", thumb shows the split percentage
- Helper text frames both length and purpose: short-form = quick takes that keep you visible, long-form = in-depth pieces that build authority

### Migration
- Silent migration — no user notification
- Drizzle SQL migration only (no separate TypeScript migration script)
- SQL migration: add `maxDraftsPerRun` and `shortFormPercent` columns, extract values from sourceConfig JSON using SQL functions, strip old fields from sourceConfig JSON
- Default values: `maxDraftsPerRun: 3`, `shortFormPercent: 70`
- Old fields removed from sourceConfig JSON immediately (no transition period)

### Form Reorganization
- Split the researcher form into visual sections with headings/dividers:
  - **Research Identity** — name, topics, keywords
  - **Sources** — subreddits, Substack feeds, search query templates, excluded domains
  - **Draft Settings** — short-form vs long-form slider, max drafts per run
  - **Channels** — linked channel multi-select
- Draft settings appear as a section within the same form (not a separate tab)

### Dead Code Cleanup
- Delete `ResearchConfigForm.tsx` — dead code since Phase 11 removed the Research Config tab
- Clean up `ResearchConfig` type in schema.ts — remove `maxDraftsPerRun`, `scheduleHours`, `contentTypeMix` fields

### Claude's Discretion
- Exact slider component implementation (may need to add shadcn/ui slider)
- Helper text wording for the short-form vs long-form slider
- Section heading styling (dividers, spacing, typography)
- Whether to show a live draft count preview below the slider
- How to handle the legacy `runResearchForChannel` code path if it still references cleaned-up fields

</decisions>

<specifics>
## Specific Ideas

- Content type architecture: publisher modules declare supported types + constraints. Short-form declares max chars. Long-form declares an HTML mapper function. Article UI always outputs HTML, adapters convert. (Captured for Phase 13 — not built in Phase 12.)
- LinkedIn API only supports posts via API (no native long-form articles). Their "article" content type is actually a link card with URL/title/description. Native article editor has no API.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ResearcherForm.tsx`: Current form component — will be restructured with visual sections, slider replaces number inputs
- `TagInput` component: Used for subreddits, feeds, keywords — stays as-is
- shadcn/ui primitives: Button, Input, Label, Textarea — slider component may need to be added
- `migrate-research-configs.ts`: Existing v1.1 TS migration pattern — not used this time (going pure SQL)

### Established Patterns
- JSON columns for config: `sourceConfig` uses `jsonb().$type<ResearchSourceConfig>()` — same column stays, just fewer fields
- Top-level columns: `maxDraftsPerRun` and `shortFormPercent` follow the pattern of other simple columns on researchers (name, topics, keywords)
- API defaults: POST /api/researchers provides default values when creating (lines 71-79 in route.ts)
- Form state: `useState` with typed config object and `updateSource` helper for nested updates

### Integration Points
- `src/db/schema.ts`: `ResearchSourceConfig` interface loses 3 fields, `ResearchConfig` interface also cleaned up, new columns added to researchers table
- `src/lib/research/engine.ts`: `buildResearchConfig()` function reads maxDraftsPerRun and contentTypeMix from sourceConfig — must read from researcher top-level columns instead
- `src/app/api/researchers/route.ts`: POST default values need updating, accept new top-level fields
- `src/app/api/researchers/[id]/route.ts`: PUT handler needs to accept new top-level fields
- `src/components/research/ResearcherForm.tsx`: Form restructured with sections, slider added
- `src/components/channels/ResearchConfigForm.tsx`: Delete (dead code)
- Test files (8+ files): All have default config objects with these fields — need updating

</code_context>

<deferred>
## Deferred Ideas

- Publisher content type declarations (short-form max chars, long-form HTML mapper interface) — Phase 13
- HTML-based article writing UI — Phase 13
- Platform-specific content type mapping in publisher adapters — Phase 13
- Automation schedule overriding maxDraftsPerRun — Phase 14

</deferred>

---

*Phase: 12-config-cleanup*
*Context gathered: 2026-03-02*
