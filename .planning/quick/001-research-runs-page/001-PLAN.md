---
phase: quick-001
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(app)/research/[id]/page.tsx
  - src/app/(app)/research/[id]/runs/page.tsx
  - src/app/(app)/research/[id]/runs/loading.tsx
  - src/app/(app)/research/[id]/runs/[runId]/page.tsx
  - src/app/(app)/research/[id]/runs/[runId]/loading.tsx
  - src/app/api/researchers/[id]/runs/route.ts
  - src/components/research/ResearchRunPanel.tsx
  - src/components/research/RunsList.tsx
  - src/components/research/RunDetail.tsx
autonomous: true
requirements: ["QUICK-001"]

must_haves:
  truths:
    - "Researcher detail page at /research/[id] shows only the configuration form (edit settings)"
    - "User can navigate to /research/[id]/runs to see all past runs for this researcher"
    - "User can start a new research run from the Runs page and see live SSE logs"
    - "User can click into a specific run at /research/[id]/runs/[runId] to see full results (sources searched, topics found)"
    - "Runs list shows run date, topic count, source count, and channel name for each run"
  artifacts:
    - path: "src/app/(app)/research/[id]/page.tsx"
      provides: "Config-only detail page with link to Runs"
    - path: "src/app/(app)/research/[id]/runs/page.tsx"
      provides: "Runs list + run trigger with SSE live logs"
    - path: "src/app/(app)/research/[id]/runs/[runId]/page.tsx"
      provides: "Individual run detail with sources and topics"
    - path: "src/app/api/researchers/[id]/runs/route.ts"
      provides: "GET endpoint returning all runs for a researcher"
    - path: "src/components/research/RunsList.tsx"
      provides: "Client component rendering runs table with links"
    - path: "src/components/research/RunDetail.tsx"
      provides: "Component rendering full run results (sources + topics)"
  key_links:
    - from: "src/app/(app)/research/[id]/runs/page.tsx"
      to: "/api/researchers/[id]/runs"
      via: "server-side DB query for runs list"
      pattern: "db\\.select.*researchRuns"
    - from: "src/app/(app)/research/[id]/runs/page.tsx"
      to: "/api/researchers/[id]/run"
      via: "ResearchRunPanel SSE fetch (existing)"
      pattern: "fetch.*api/researchers.*run"
    - from: "src/app/(app)/research/[id]/runs/[runId]/page.tsx"
      to: "researchRuns table"
      via: "server-side DB query for single run"
      pattern: "db\\.select.*researchRuns.*where"
---

<objective>
Split the researcher detail page (/research/[id]) into two concerns: (1) a Configuration page for editing researcher settings, and (2) a Runs page that lists all research runs, allows starting new runs with live SSE logs, and lets users click into individual runs to see full sources and topics.

Purpose: Give users full visibility into research run history and results, separating operational concerns (running/viewing research) from configuration concerns (editing researcher settings).
Output: New /research/[id]/runs route with runs list, new /research/[id]/runs/[runId] route for run details, cleaned-up config page with navigation to runs.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/app/(app)/research/[id]/page.tsx
@src/app/(app)/research/page.tsx
@src/components/research/ResearchRunPanel.tsx
@src/components/research/ResearcherCard.tsx
@src/components/research/ResearcherForm.tsx
@src/app/api/researchers/[id]/run/route.ts
@src/app/api/researchers/[id]/route.ts
@src/db/schema.ts
@src/lib/research/progress.ts

<interfaces>
<!-- Key types and contracts the executor needs -->

From src/db/schema.ts:
```typescript
export const researchRuns = pgTable('research_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').references(() => channels.id, { onDelete: 'cascade' }).notNull(),
  researcherId: uuid('researcher_id').references(() => researchers.id, { onDelete: 'set null' }),
  sourcesSearched: jsonb('sources_searched').$type<ResearchSource[]>(),
  topicsFound: jsonb('topics_found').$type<TopicRecommendation[]>(),
  draftsGenerated: jsonb('drafts_generated').$type<string[]>(),
  aiModel: text('ai_model'),
  tokensUsed: integer('tokens_used'),
  runAt: timestamptz('run_at').defaultNow().notNull(),
});

export interface ResearchSource {
  url: string;
  title: string;
  summary: string;
  source: 'exa' | 'reddit' | 'substack' | 'brainstorm';
}

export interface TopicRecommendation {
  title: string;
  angle: string;
  whyTimely: string;
  relevanceScore: number;
  contentType: 'note' | 'article';
  sources: ResearchSource[];
}
```

From src/lib/research/progress.ts:
```typescript
export type ResearchProgressEvent =
  | { type: 'adapter-start'; adapterId: string; adapterName: string }
  | { type: 'adapter-result'; adapterId: string; adapterName: string; sourceCount: number }
  | { type: 'adapter-error'; adapterId: string; adapterName: string; error: string }
  | { type: 'topic-ranking'; topicCount: number }
  | { type: 'run-complete'; runId: string; topicCount: number; sourceCount: number }
  | { type: 'run-error'; error: string };

export type OnProgress = (event: ResearchProgressEvent) => void;
```

Existing API patterns (from src/app/api/researchers/[id]/route.ts):
```typescript
// All API routes use auth() wrapper, return NextResponse.json
// Error handling via apiError('operation', err)
export const GET = auth(function GET(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return (async () => { ... })();
});
```

Existing page patterns:
```typescript
// Server components with `export const dynamic = 'force-dynamic'`
// Standard header: px-6 py-5 border-b border-border shrink-0
// Back button: Button asChild variant="ghost" size="sm"
// Loading skeletons in loading.tsx using Skeleton component
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create Runs list page and API, refactor detail page</name>
  <files>
    src/app/(app)/research/[id]/page.tsx,
    src/app/(app)/research/[id]/runs/page.tsx,
    src/app/(app)/research/[id]/runs/loading.tsx,
    src/app/api/researchers/[id]/runs/route.ts,
    src/components/research/RunsList.tsx
  </files>
  <action>
    **1. Create GET /api/researchers/[id]/runs API route** (`src/app/api/researchers/[id]/runs/route.ts`):
    - Follow existing auth pattern from `src/app/api/researchers/[id]/route.ts`
    - Query `researchRuns` table WHERE `researcherId = id`, ordered by `runAt` DESC
    - Join with `channels` table to include `channelName` and `platform` for each run
    - Return array of objects: `{ id, channelId, channelName, platform, runAt, topicCount (computed via jsonb_array_length), sourceCount (computed via jsonb_array_length on sourcesSearched), aiModel }`
    - Use `apiError` for error handling, same pattern as existing routes

    **2. Create RunsList client component** (`src/components/research/RunsList.tsx`):
    - `'use client'` component accepting `runs` array and `researcherId` as props
    - Render a table/list of runs with columns: Date (formatted via toLocaleDateString + toLocaleTimeString), Channel, Sources, Topics, and a right-arrow link
    - Each row links to `/research/${researcherId}/runs/${run.id}`
    - Empty state: "No runs yet. Start your first research run above."
    - Style: Use existing card-style patterns — `border border-border bg-card rounded-lg`, `text-sm`, `font-mono` for dates
    - Each row should be a Link with hover state matching `ResearcherCard` hover pattern (hover:border-primary/40)

    **3. Create Runs page** (`src/app/(app)/research/[id]/runs/page.tsx`):
    - Server component with `export const dynamic = 'force-dynamic'`
    - Load researcher (404 if not found), load all runs via direct DB query (same query as API but server-side)
    - Page header: Back button linking to `/research/${id}`, title "{researcher.name} - Runs", subtitle showing run count
    - Include the existing `ResearchRunPanel` component at the top for starting new runs (move from detail page)
    - Below that, render `RunsList` with the fetched runs
    - After a run completes in ResearchRunPanel, user can refresh to see new run in list (no need for automatic refresh in this task)

    **4. Create loading skeleton** (`src/app/(app)/research/[id]/runs/loading.tsx`):
    - Follow existing pattern from `src/app/(app)/research/[id]/loading.tsx`
    - Show skeleton for header + run panel area + list area

    **5. Refactor detail page** (`src/app/(app)/research/[id]/page.tsx`):
    - REMOVE the `ResearchRunPanel` import and the "Run Research" panel section entirely
    - KEEP the `ResearcherForm` (config editing) as the main content
    - ADD a prominent link/button to `/research/${id}/runs` in the page header area, next to the title
    - Use `Button asChild variant="outline" size="sm"` with text "View Runs" or similar, linking to runs page
    - This page is now purely for configuration
  </action>
  <verify>
    <automated>cd /Users/dknell/Projects/orbitl && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - /research/[id] page shows only config form + link to runs
    - /research/[id]/runs page loads and shows ResearchRunPanel + RunsList
    - GET /api/researchers/[id]/runs returns runs with channel info
    - TypeScript compiles without errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Create individual Run detail page with sources and topics</name>
  <files>
    src/app/(app)/research/[id]/runs/[runId]/page.tsx,
    src/app/(app)/research/[id]/runs/[runId]/loading.tsx,
    src/components/research/RunDetail.tsx
  </files>
  <action>
    **1. Create RunDetail component** (`src/components/research/RunDetail.tsx`):
    - Server component (no 'use client' needed — pure display)
    - Props: `run` object containing full run data (id, runAt, channelName, platform, aiModel, sourcesSearched: ResearchSource[], topicsFound: TopicRecommendation[])
    - **Summary section** at top: card showing run date/time, channel name with platform badge (reuse PLATFORM_STYLES pattern from ResearcherCard), AI model used, total sources count, total topics count
    - **Topics section**: Render each TopicRecommendation as a card:
      - Title (bold), angle (muted text below), whyTimely (italic or muted), relevanceScore as a small badge (e.g., "85" with color coding: green >70, yellow 40-70, red <40), contentType badge ("note" or "article")
      - Below each topic, list its sources as small links (url + title) in a collapsed/subtle list
      - Sort by relevanceScore descending (should already be sorted from API, but enforce it)
    - **Sources section**: Collapsible or separate area showing ALL sourcesSearched:
      - Group by source type (exa, reddit, substack, brainstorm)
      - Each source: title as link to URL, summary text, source badge
      - Style: compact list with `text-sm`, external links open in new tab (`target="_blank" rel="noopener noreferrer"`)

    **2. Create Run detail page** (`src/app/(app)/research/[id]/runs/[runId]/page.tsx`):
    - Server component with `export const dynamic = 'force-dynamic'`
    - Extract both `id` (researcher) and `runId` from params
    - Load researcher (404 if not found) and the specific run from `researchRuns` WHERE `id = runId` AND `researcherId = id`
    - Also join with channels to get channelName and platform
    - If run not found, call notFound()
    - Page header: Back button linking to `/research/${id}/runs`, title showing researcher name + run date
    - Render `RunDetail` component with the full run data

    **3. Create loading skeleton** (`src/app/(app)/research/[id]/runs/[runId]/loading.tsx`):
    - Standard skeleton: header area + summary card skeleton + 3-4 topic card skeletons
    - Follow existing Skeleton component patterns

    **4. Wire up navigation**: Ensure RunsList rows from Task 1 link correctly to `/research/${researcherId}/runs/${run.id}`. The RunDetail back button links to `/research/${id}/runs`.
  </action>
  <verify>
    <automated>cd /Users/dknell/Projects/orbitl && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - /research/[id]/runs/[runId] page loads and displays full run details
    - Topics are displayed as cards with relevance scores and source links
    - Sources are grouped by type with external links
    - Navigation: runs list -> run detail -> back to runs list works
    - TypeScript compiles without errors
  </done>
</task>

<task type="checkpoint:human-verify" gate="non-blocking">
  <what-built>
    Split the researcher detail page into Config (/research/[id]) and Runs (/research/[id]/runs) pages. Created individual run detail view at /research/[id]/runs/[runId] showing full topics and sources.
  </what-built>
  <how-to-verify>
    1. Navigate to /research and click on an existing researcher
    2. Confirm the detail page shows ONLY the config form (no "Run Research" panel)
    3. Confirm there is a "View Runs" button/link in the header
    4. Click "View Runs" to navigate to /research/[id]/runs
    5. Confirm the Runs page shows the "Run Research" panel at top and a list of past runs below
    6. If there are past runs, click into one and confirm you see full topic recommendations with scores and source links
    7. Verify back navigation works at each level
  </how-to-verify>
  <resume-signal>Type "approved" or describe any issues with layout, navigation, or data display</resume-signal>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes with zero errors
- All new routes are accessible: /research/[id], /research/[id]/runs, /research/[id]/runs/[runId]
- Navigation flow: research list -> researcher config -> runs -> run detail (and back at each level)
- Existing functionality preserved: config editing still works, run triggering still works (just moved to runs page)
</verification>

<success_criteria>
- Researcher detail page (/research/[id]) shows only configuration form with link to runs
- Runs page (/research/[id]/runs) lists all past runs with dates, channels, counts, and allows starting new runs
- Run detail page (/research/[id]/runs/[runId]) displays full topics (with scores) and sources (grouped by type)
- All navigation links work bidirectionally
- TypeScript compiles cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/001-research-runs-page/001-SUMMARY.md`
</output>
