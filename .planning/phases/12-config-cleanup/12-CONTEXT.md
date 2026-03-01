# Phase 12: Config Cleanup - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Reorganize config fields so draft generation and automation settings live in the right place with clear labels. Move `maxDraftsPerRun` and `contentTypeMix` out of research source config into a dedicated draft settings area. Remove `scheduleHours` entirely (replaced by automation config in Phase 14). Relabel "Note %" as "Note vs Article %" with explanation. No new capabilities — just moving, renaming, and removing fields.

</domain>

<decisions>
## Implementation Decisions

### Field Relocation
- Add a `draftSettings` JSON column on the `researchers` table to house `maxDraftsPerRun` and `contentTypeMix`
- Both fields move together — they control draft output, not research sources
- `scheduleHours` is removed entirely (no new home — Phase 14's automation config replaces it)
- Phase 14 automation schedules will be able to override `maxDraftsPerRun` per schedule (per AUTO-03 requirement), so the researcher-level value acts as a default

### Note vs Article UX
- Replace the bare "Note %" number input with a slider
- Slider: left side labeled "Notes", right side labeled "Articles", thumb shows the split percentage
- Notes = short + casual posts (a few paragraphs, conversational tone)
- Articles = long + polished pieces (structured with headings, researched, formal)
- Helper text should convey both the length and tone difference

### Claude's Discretion
- Whether to rename `sourceConfig` to something clearer (e.g., `researchSources`) now that draft/scheduling fields are gone
- Helper text wording for the note/article slider (should match existing UI copy style)
- Whether to show a live draft count preview below the slider (e.g., "At 70/30 with 3 drafts: ~2 notes, ~1 article")
- Migration approach: silent vs logged, SQL migration vs TypeScript migration script
- Whether to remove old fields from sourceConfig immediately or keep them readable during a transition period
- Visual sections vs flat layout for the reorganized form
- Whether draft settings appear on the same form (own section) or as a separate tab
- Dead code cleanup: whether to delete ResearchConfigForm.tsx and clean up the ResearchConfig type

</decisions>

<specifics>
## Specific Ideas

No specific references — open to standard approaches. The existing form pattern (ResearcherForm.tsx) uses shadcn/ui inputs, labels, and tag inputs with Tailwind styling.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ResearcherForm.tsx`: Current form component — will be modified to remove fields and add slider
- `TagInput` component: Used for subreddits, feeds, keywords — stays as-is
- shadcn/ui primitives: Button, Input, Label, Textarea — slider component may need to be added
- `migrate-research-configs.ts`: Existing v1.1 migration pattern — TypeScript script that reads rows, transforms, writes back

### Established Patterns
- JSON columns for config: `sourceConfig` uses `jsonb().$type<ResearchSourceConfig>()` pattern — same pattern for new `draftSettings`
- API defaults: POST /api/researchers provides default values when creating (lines 71-79 in route.ts)
- Form state: `useState` with typed config object and `updateSource` helper for nested updates

### Integration Points
- `src/db/schema.ts`: Both `ResearchConfig` and `ResearchSourceConfig` interfaces need updating
- `src/lib/research/engine.ts`: `buildResearchConfig()` function reads these fields from sourceConfig — must read from draftSettings instead
- `src/app/api/researchers/route.ts`: POST default values need updating
- `src/app/api/researchers/[id]/route.ts`: PUT handler needs to accept draftSettings
- `src/components/research/ResearcherForm.tsx`: Form needs restructuring
- `src/components/channels/ResearchConfigForm.tsx`: Potentially dead code from Phase 11 removal
- Test files (8+ files): All have default config objects with these fields — need updating

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-config-cleanup*
*Context gathered: 2026-03-01*
