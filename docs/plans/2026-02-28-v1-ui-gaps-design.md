# v1.0 UI Gap Fixes — Design

**Date:** 2026-02-28
**Status:** Approved

## Problem

Five UI gaps shipped in v1.0 where backend functionality exists but is inaccessible to users:

1. VoiceWizard component exists but isn't mounted in any page
2. No form to configure researchConfig on a channel (topics, keywords, subreddits, etc.)
3. No "Run Research" button in the UI (API exists at POST /api/research)
4. No visibility into research run status (researchRuns table has data, no UI)
5. Publish-now route is a stub — sets status to 'publishing' but never calls the publisher

## Decisions

- **Channel detail layout:** Tabbed (Overview / Voice / Research Config) using shadcn Tabs, matching the existing AuditTabs pattern
- **Research results viewer:** Minimal — status line on Overview tab (last run date + topic count). No dedicated viewer.
- **Publish-now behavior:** Fire-and-forget — return 'publishing' immediately, publish in background. Consistent with /api/research.

## Design

### 1. Channel Detail Page — Tabbed Layout

Restructure `/channels/[id]/page.tsx` from flat page into tabbed layout.

**Overview tab (default):**
- Existing ChannelCostSummary
- Voice status line: "Voice configured" (green) or "No voice profile" with link to Voice tab
- Research status line: last run date + topics found, or "Research not configured" with link to Research Config tab
- "Run Research Now" button (POST /api/research, disabled if no researchConfig)

**Voice tab:**
- No profile: "Set up your voice" button → opens VoiceWizard dialog
- Profile exists: read-only personaPrompt display + "Retrain Voice" button → re-opens wizard

**Research Config tab:**
- Form fields for all ResearchConfig properties:
  - topics, keywords, subreddits, substackFeeds, excludedDomains — tag inputs (Enter to add, X to remove)
  - searchQueryTemplates — textarea, one template per line, {topic} placeholder
  - contentTypeMix — note/article percentage inputs
  - maxDraftsPerRun — number input
  - scheduleHours — number input
- Save via PATCH /api/channels/[id] with { researchConfig }

### 2. Publish-Now Fix (Backend)

Update `src/app/api/queue/[id]/publish-now/route.ts`:

1. Keep existing validation (item exists, status is 'queued')
2. Set status to 'publishing' and return response immediately
3. Fire-and-forget: fetch full item (draft + channel), get publisher from registry, call provider.publish()
4. On success: set 'published', store platformResponse, update draft status
5. On failure: apply same retry logic as runPublishQueue() (exponential backoff, max 3 retries)
6. Handle registry initialization — use idempotent init guard

### 3. New Components

| Component | Location |
|---|---|
| ChannelTabs | src/components/channels/ChannelTabs.tsx |
| OverviewTab | src/components/channels/OverviewTab.tsx |
| VoiceTab | src/components/channels/VoiceTab.tsx |
| ResearchConfigForm | src/components/channels/ResearchConfigForm.tsx |
| TagInput | src/components/ui/tag-input.tsx |

### 4. Modified Files

| File | Change |
|---|---|
| src/app/(app)/channels/[id]/page.tsx | Fetch voice profiles + last research run, render ChannelTabs |
| src/app/api/queue/[id]/publish-now/route.ts | Implement actual publishing with fire-and-forget |

### 5. No New API Routes

All needed endpoints already exist:
- PATCH /api/channels/[id] — supports researchConfig updates
- POST /api/voice — handles voice wizard submission
- POST /api/research — triggers research run
