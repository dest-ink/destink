# Workflow Dashboard Design Spec

## Problem

The current UI is organized around database entities (Channels, Research, Drafts, Queue, AI Usage). Running research requires 3 clicks deep: Research → researcher card → View Runs → Run Research. Users can't see the pipeline status at a glance, don't know what action to take next, and credentials are buried in channel settings.

## Solution

Replace entity-based navigation with workflow-based navigation. Introduce a Dashboard as the home page showing all content machines as pipeline cards, and a Pipeline Detail page for inline research/draft actions.

---

## Navigation

**Before:**
```
+ New
Channels    ◈
Research    ◆
Drafts      ◇
Queue       ◉
AI Usage    ◎
```

**After:**
```
+ New ▾ (dropdown)
Dashboard
Drafts
Queue
Settings
```

### "+ New" Dropdown

The "+ New" button becomes a dropdown (using shadcn Popover or DropdownMenu) with two sections:

**Workflows:**
- **Content Machine** → `/get-started` (full AI onboarding)
- **Research Run** → triggers a "pick researcher" dropdown, then runs research inline on dashboard

**Manual:**
- **Channel** → `/settings/channels/new`
- **Researcher** → `/settings/researchers/new`

### Settings

Settings absorbs the power-user config pages:
- `/settings` — overview
- `/settings/channels` — channel list (currently `/channels`)
- `/settings/channels/[id]` — channel detail with tabs (currently `/channels/[id]`)
- `/settings/channels/new` — create channel (currently `/channels/new`)
- `/settings/researchers` — researcher list (currently `/research`)
- `/settings/researchers/[id]` — researcher config form (currently `/research/[id]`)
- `/settings/researchers/new` — create researcher (currently `/research/new`)
- `/settings/ai-usage` — AI audit (currently `/audit`)

These are simple re-routes of existing pages — no new UI needed, just moving files.

---

## Dashboard (`/dashboard`)

The default landing page. Shows all content machines as pipeline cards.

### What is a "Content Machine"?

A content machine = a researcher linked to a channel. The dashboard queries researchers with their linked channels, credentials status, automation schedules, and last run info.

### Pipeline Card

Each card shows:

```
┌─────────────────────────────────────────────────────────┐
│  AI Trends & Ideas                              LinkedIn │
│                                                          │
│  ● Channel  ● Voice  ● Credentials  ○ Research          │
│                                                          │
│  Next: Run your first research                           │
│                                                          │
│  Schedule: Daily at 8am · Auto-draft on                  │
│  Last run: Never                                         │
│                                                          │
│  [Run research]                          [Settings ⚙]   │
└─────────────────────────────────────────────────────────┘
```

**Pipeline dots:**
- ● = configured (green)
- ⚠ = needs attention (amber)
- ○ = not done yet (gray)

**Steps:** Channel → Voice → Credentials → Research

**"Next" line** — computed from pipeline status:
- Missing credentials → "Add publishing credentials"
- No runs yet → "Run your first research"
- Has runs, no drafts → "Generate drafts from latest research"
- Has pending drafts → "3 drafts waiting for review"
- Everything done → "All caught up" + last run date

**Primary action button** — always shows the next logical action:
- "Add credentials" / "Run research" / "Generate drafts" / "Review drafts"

**Clicking the card** (anywhere except buttons) → navigates to `/pipelines/[researcherId]`

### Empty State

When no content machines exist:
```
No content machines yet.
Create your first one — it takes about 30 seconds.

[Create content machine →]
```

Button goes to `/get-started`.

### Data Requirements

New API endpoint: `GET /api/dashboard`

Returns for each researcher:
```typescript
{
  researcherId: string;
  researcherName: string;
  topics: string[];
  channel: {
    id: string;
    name: string;
    platform: string;
    hasVoice: boolean;        // personaPrompt is not null
    hasCredentials: boolean;  // credentials is not null
  } | null;
  schedule: {
    cronExpression: string;
    enabled: boolean;
    nextRunAt: string | null;
  } | null;
  lastRun: {
    id: string;
    runAt: string;
    topicCount: number;
    sourceCount: number;
    draftsGenerated: string[] | null;
  } | null;
  pendingDraftCount: number;
  autoDraft: boolean;
}
```

---

## Pipeline Detail Page (`/pipelines/[researcherId]`)

This is the "living dashboard" for one content machine. It reuses the same inline research/draft flow we built in the onboarding ReviewStep, but as a permanent page.

### Layout

```
← Back to Dashboard

AI Trends & Ideas                                   LinkedIn
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pipeline Status
● Channel ✓  ● Voice ✓  ⚠ Credentials  ○ First research run

[Credentials form if missing — same inline form from onboarding]

───────────────────────────────────────────────────────────

[Run research →]                               Schedule: Daily at 8am

[Live SSE log when running]

[Topic results when complete]

[Draft previews when generated]

───────────────────────────────────────────────────────────

Past Runs
[Run list — compact version]

───────────────────────────────────────────────────────────

⚙ Settings links: Edit channel · Edit researcher · Edit automation
```

### Sections

1. **Header** — researcher name, linked channel badge
2. **Pipeline status bar** — visual dots showing what's configured
3. **Credentials inline** — shows form if not configured (same as onboarding)
4. **Action zone** — primary CTA (run research / generate drafts / review drafts) + SSE log
5. **Past runs** — compact list of previous runs with topic/source counts
6. **Settings links** — edit channel, researcher, automation (links to Settings pages)

### Data Requirements

Server component fetches:
- Researcher with all fields
- Linked channel with voice/credentials status
- Automation schedule
- Research runs (last 10)
- Pending draft count for this channel

The action zone (run research, generate drafts) is a client component that handles SSE streaming — similar to what we already built in ReviewStep.

---

## Implementation Strategy

### Phase 1: Dashboard + Pipeline Detail (core value)
1. Create `GET /api/dashboard` endpoint
2. Create `/dashboard` page with pipeline cards
3. Create `/pipelines/[researcherId]` page with inline actions
4. Update nav: Dashboard replaces Channels/Research

### Phase 2: Settings consolidation
5. Move channel pages under `/settings/channels/...`
6. Move researcher pages under `/settings/researchers/...`
7. Move audit page under `/settings/ai-usage`
8. Create Settings nav/layout

### Phase 3: Nav cleanup
9. Replace SideNav with new nav (Dashboard, Drafts, Queue, Settings)
10. Convert "+ New" to dropdown
11. Set `/dashboard` as default route (redirect from `/`)

### What stays unchanged
- Drafts page — already works well
- Queue page — already works well
- Onboarding flow (`/get-started`) — already built
- All existing API routes — untouched, just pages move
