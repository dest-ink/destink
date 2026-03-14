# Phase 14: Automation Config - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can configure when research runs happen automatically and whether those runs generate drafts, all in a dedicated automation settings area separate from research source config. This phase builds the schema, API, and UI for automation schedules. The actual cron worker that executes scheduled runs is Phase 15.

</domain>

<decisions>
## Implementation Decisions

### Schedule Input UX
- Interval picker with named presets, not cron expression or freeform input
- Options: "Twice daily" (12h), "Daily" (24h), "Every other day" (48h), "Every 3 days" (72h), "Weekly" (168h)
- Show "Next run" preview below the picker (e.g., "Next run: Monday Mar 16 at ~3:00 PM")
- Store as cron expression internally for future flexibility, even though UI shows friendly presets

### Settings Placement (AUTO-05)
- Automation config lives on its own page at `/research/[id]/automation` — NOT a section within ResearcherForm
- This satisfies AUTO-05's requirement that automation is "separate from research source config"
- The researcher detail page needs navigation to the automation page (link or nav element)

### Schema: Separate Schedules Table
- Multiple schedules per researcher — separate `automationSchedules` table with FK to researchers
- Each schedule has: name (optional, user-defined), cronExpression (string), enabled (boolean), nextRunAt (timestamp)
- Name defaults to interval description if left blank (e.g., "Every 24 hours")
- Schedules have their own enable/disable toggle — user can configure a schedule but leave it paused

### Per-Schedule Overrides
- Each schedule can override `maxDraftsPerRun` and `autoDraft` from the researcher defaults
- Override columns are nullable — null means "inherit from researcher"
- UI shows researcher defaults as placeholder text, override fields start empty
- Worker resolves: `schedule.maxDraftsPerRun ?? researcher.maxDraftsPerRun`
- No override for shortFormPercent, topics, or source config — keep it focused

### Multiple Schedules
- Card list UI on `/research/[id]/automation` — each schedule is a card showing interval, next run time, overrides
- "Add Schedule" button creates a new schedule
- Edit and delete actions on each card
- Overlapping schedules: allow concurrent runs (both fire independently, no skip/queue logic)

### Claude's Discretion
- Card component styling and layout details
- How the "Add Schedule" form is presented (inline vs modal vs separate view)
- Cron expression generation from interval presets (mapping "Daily" to `0 0 * * *` etc.)
- "Next run" time calculation logic
- Whether to show schedule run history on the automation page
- API route structure for schedule CRUD

</decisions>

<specifics>
## Specific Ideas

- Phase 12 established the section pattern in ResearcherForm (Research Identity, Sources, Draft Settings, Channels) — automation intentionally does NOT follow this pattern, living on its own page instead
- The existing daemon uses `node-cron` with `schedule('* * * * *', ...)` — the worker (Phase 15) will use the same library to evaluate cron expressions from the schedules table
- Override UX: "Max drafts: [  ] (default: 3)" — empty = inherit, filled = override

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ResearcherForm.tsx`: Existing form with sections — will NOT be modified (automation is separate page)
- `node-cron` library: Already in dependencies, used by daemon for minute-by-minute polling
- shadcn/ui primitives: Button, Input, Label, Checkbox — reusable for schedule form
- `Slider` component: Not needed for automation (interval is a select/dropdown, not a slider)

### Established Patterns
- Drizzle ORM schema with `pgTable`, integer/boolean/text columns, jsonb for complex data
- API routes at `src/app/api/researchers/[id]/...` — schedule CRUD follows same nesting
- Server components for pages, client components for interactive forms
- `force-dynamic` on pages that need fresh DB data
- SSE pattern for live progress (not needed for config, but relevant for Phase 15)

### Integration Points
- `src/db/schema.ts`: New `automationSchedules` table with FK to `researchers.id`
- `src/app/api/researchers/[id]/schedules/`: New CRUD routes (GET, POST, PUT, DELETE)
- `src/app/(app)/research/[id]/automation/page.tsx`: New page route
- `src/app/(app)/research/[id]/page.tsx`: Add navigation link to automation page
- `src/components/research/`: New components for schedule cards and form
- Worker (Phase 15) reads `automationSchedules` table to determine what to run and when

</code_context>

<deferred>
## Deferred Ideas

- Cron expression power-user input (future enhancement on the interval picker)
- Schedule run history on the automation page (could show last N automated runs)
- Skip-if-running overlap prevention (decided to allow concurrent for now)
- Timezone configuration per schedule (use server timezone for now)

</deferred>

---

*Phase: 14-automation-config*
*Context gathered: 2026-03-14*
