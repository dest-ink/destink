# Orbitl — Design Document
**Date:** 2026-02-25
**Status:** Approved

---

## Overview

Orbitl is a personal content automation system that handles the full lifecycle from topic discovery to scheduled publishing across multiple Substack publications and LinkedIn profiles. It is designed as a private, self-hosted tool that works while you're away — researching, drafting, and publishing according to your voice, views, and configured schedules.

**Core principles:**
- No content ever publishes without explicit human approval
- All AI usage is fully audited (tokens, cost, model, operation)
- Each publishing destination (channel) has its own voice, topics, and schedule
- Local-first data (Postgres on your own infrastructure, no third-party SaaS required)

---

## System Architecture

### Runtime Components

```
┌───────────────────────────────────────────────────────────┐
│                        ORBITL                             │
│                                                           │
│   ┌─────────────────────┐   ┌────────────────────────┐   │
│   │   Next.js App        │   │   Node.js Daemon       │   │
│   │   (UI + API Routes) │   │   (Background Worker)  │   │
│   │                     │   │                        │   │
│   │  • Channel mgmt     │   │  • Publish queue loop  │   │
│   │  • Draft review     │   │  • Live publish check  │   │
│   │  • Queue mgmt       │   │    (every 1 min)       │   │
│   │  • Schedule view    │   │  • Publishing executor │   │
│   │  • Voice wizard     │   │  • Retry/failure mgmt  │   │
│   │  • AI audit log     │   │                        │   │
│   └──────────┬──────────┘   └──────────┬─────────────┘   │
│              │                         │                  │
│              └────────────┬────────────┘                  │
│                           │                               │
│                    ┌──────▼──────┐                        │
│                    │  PostgreSQL  │                        │
│                    │  (shared)   │                        │
│                    └─────────────┘                        │
│                                                           │
│   Kubernetes CronJobs (k3s):                              │
│   • research-runner   (every 6 hours, per channel)        │
│   • daily-summary     (every 24 hours)                    │
└───────────────────────────────────────────────────────────┘

External APIs:
  • Anthropic API          — research analysis + content generation
  • Exa API                — web search for topic discovery
  • Reddit API             — trending discussions monitoring
  • Substack unofficial API (jakub-k-slys/substack-api)
  • LinkedIn API (OAuth)   — official post creation
```

### Tech Stack

| Layer | Technology |
|---|---|
| UI | Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| API | Next.js API Routes |
| Background daemon | Node.js with `tsx`, `node-cron` |
| Scheduled jobs | Kubernetes CronJobs (k3s) |
| Database | PostgreSQL (via Drizzle ORM) |
| AI | Anthropic SDK — `claude-sonnet-4-6` (drafting), `claude-haiku-4-5` (triage) |
| Web search | Exa API |
| Social listening | Reddit API (read-only, no app required) |
| Substack publishing | `substack-api` npm package |
| LinkedIn publishing | LinkedIn API v2 (OAuth 2.0) |

### Deployment

| Environment | Method |
|---|---|
| Local dev (laptop) | Docker Compose, port 3021 |
| Production (Mac Mini) | k3s cluster, Helm chart |

**Docker Compose services:** `web`, `daemon`, `db`
**k3s resources:** Deployment (web), Deployment (daemon), StatefulSet (postgres), CronJob (research-runner), CronJob (daily-summary), Helm chart for orchestration

---

## Data Model

### `channels`
```sql
id              uuid PRIMARY KEY
name            text NOT NULL
platform        enum('linkedin', 'substack') NOT NULL
platform_id     text                          -- LinkedIn member ID or Substack pub slug
persona_prompt  text                          -- assembled voice prompt for AI
research_config jsonb                         -- topics, keywords, subreddits, substack feeds, exclusions
schedule_config jsonb                         -- posting frequency, time windows, spacing rules
credentials     text                          -- AES-256 encrypted JSON (tokens, cookies)
created_at      timestamptz
updated_at      timestamptz
```

### `voice_profiles`
```sql
id               uuid PRIMARY KEY
channel_id       uuid REFERENCES channels
method           enum('archive', 'samples', 'wizard')
raw_input        text        -- original archive text or sample posts
extracted_profile jsonb      -- tone descriptors, recurring themes, opinion stances, avoid list
created_at       timestamptz
updated_at       timestamptz
```

### `drafts`
```sql
id                   uuid PRIMARY KEY
channel_id           uuid REFERENCES channels
content_type         enum('note', 'article')
title                text
headline_options     jsonb       -- array of 2-3 headline options
hook                 text
body                 text
cta                  text
voice_confidence     integer     -- 0-100, Claude self-rated
research_sources     jsonb       -- source links and summaries used
ai_model             text
prompt_tokens        integer
completion_tokens    integer
status               enum('pending_review', 'approved', 'rejected', 'published')
rejection_reason     text
regeneration_note    text        -- user note for regeneration
created_at           timestamptz
updated_at           timestamptz
```

### `publish_queue`
```sql
id                uuid PRIMARY KEY
draft_id          uuid REFERENCES drafts
channel_id        uuid REFERENCES channels
scheduled_for     timestamptz
published_at      timestamptz
platform_response jsonb
status            enum('queued', 'publishing', 'published', 'failed')
retry_count       integer DEFAULT 0
error_message     text
created_at        timestamptz
```

### `research_runs`
```sql
id               uuid PRIMARY KEY
channel_id       uuid REFERENCES channels
sources_searched jsonb           -- which APIs were queried, with query params
topics_found     jsonb           -- raw topic recommendations from AI analysis
drafts_generated uuid[]          -- draft IDs spawned from this run
ai_model         text
tokens_used      integer
run_at           timestamptz
```

### `ai_audit_log`
```sql
id             uuid PRIMARY KEY
operation      text         -- 'research', 'draft_generation', 'voice_analysis', 'topic_ranking', etc.
model          text
prompt_tokens  integer
completion_tokens integer
cost_usd       numeric(10,6)
channel_id     uuid REFERENCES channels NULL
entity_type    text         -- 'draft', 'research_run', 'voice_profile'
entity_id      uuid NULL
created_at     timestamptz
```

---

## Channel & Persona System

### Channel Types
- **LinkedIn channel** — maps to one LinkedIn profile. One OAuth token per channel.
- **Substack channel** — maps to one publication. Multiple publications from the same account are separate channels, each with its own voice and research config.

### Voice Onboarding (3 methods, combinable)

**Method 1 — Archive Ingest**
- Input: Substack RSS URL or LinkedIn profile URL
- System fetches past posts, sends to Claude for analysis
- Outputs structured `extracted_profile`: tone descriptors, sentence length patterns, recurring opinions, topics covered, topics to avoid, vocabulary characteristics

**Method 2 — Writing Samples**
- Input: 3–10 posts pasted or uploaded as text
- Same Claude analysis pipeline as archive ingest
- Good for seeding a new channel from writing done elsewhere

**Method 3 — Interview Wizard**
- Multi-step guided form with questions such as:
  - "Describe your writing style in 3 words"
  - "What's a belief you hold that most people in your field disagree with?"
  - "What topics do you never want to cover?"
  - "What other writers do you admire? Why?"
  - "Who is your ideal reader?"
- Answers assembled into a structured persona prompt without AI analysis

All methods write to `voice_profiles`. The `persona_prompt` on the `channels` table is assembled from all active voice profiles for that channel.

### Research Config (per channel)
- Topics / keywords to search for
- Subreddits to monitor
- Substack publications to watch (for trend signals)
- Web search query templates
- Excluded sources or domains
- Content type mix preference (% notes vs articles)
- Max drafts to auto-generate per research run

---

## Research Engine

Runs as a **Kubernetes CronJob** (`research-runner`) on a configurable schedule (default: every 6 hours per channel).

### Pipeline

```
1. Gather signals (parallel)
   ├── Exa web search        — queries from channel's topic config
   ├── Reddit API            — trending posts in configured subreddits
   ├── AI brainstorm         — Claude generates 5-10 ideas from persona + recent history
   └── Substack feed monitor — recent popular posts from watched publications

2. AI analysis & ranking (Claude claude-haiku-4-5)
   Input:  all gathered signals + channel voice profile + recent published posts
   Output: ranked topic recommendations, each with:
           - Relevance score to persona (0-100)
           - Why it's timely right now
           - Suggested angle / your likely take
           - Recommended content type (note vs article)
           - Source links

3. Draft generation trigger
   - Top N recommendations (from research_config) → spawn draft generation jobs
   - Remaining → stored in topics backlog, triggerable from UI

4. Logging
   - Full research_run record written to DB
   - All AI calls logged to ai_audit_log
```

---

## Content Generation Pipeline

Triggered automatically by research engine, or manually from UI (on-demand for any topic in backlog).

### Per-Draft Process

1. **Context assembly**
   - Channel voice profile (persona_prompt)
   - Last 5–10 published posts from this channel (deduplication signal)
   - Research sources for this topic (article summaries, Reddit thread summaries)
   - Content type spec (note vs article)

2. **Generation** (Claude `claude-sonnet-4-6`)
   - Output: headline options (2–3), hook, full body, CTA, voice confidence score
   - Model self-rates voice confidence (0–100); drafts below 60 flagged in UI
   - All tokens logged to `ai_audit_log`

3. **Storage**
   - Saved as `draft` with status `pending_review`
   - Linked to source `research_run`

4. **Regeneration**
   - From review UI: add a note ("make it more contrarian", "shorter", "add the stat about X")
   - System re-runs generation with original context + regeneration note
   - New draft version created, original preserved

---

## Review Queue UI

### Draft Review View
- Card list of `pending_review` drafts, filterable by channel, content type, date, voice confidence
- Card shows: title, channel, content type, word count, voice confidence badge, age
- Click → full preview: headline options, hook, body, CTA, source links
- Actions:
  - **Approve** → moves to publish queue, auto-assigns scheduled time
  - **Reject** → optionally add note, moves to rejected
  - **Edit** → inline rich text editor, saves as new version before approving
  - **Regenerate** → text field for note, fires new draft generation

### Publish Queue View
- Timeline view of approved content awaiting publication
- Each item: channel name, content type, title preview, scheduled datetime
- **Drag-to-reorder** to adjust priority/timing
- **"Publish Now"** button for immediate override
- Status badges: queued / publishing / published / failed (with error detail on hover)
- Failed items surface prominently with retry option

### Channel Dashboard
- Per-channel: drafts in review queue, posts published this week, AI cost this month
- Quick links: research config, voice profile, schedule settings
- "Run research now" manual trigger

---

## Publish Queue & Smart Scheduling

### Auto-scheduling Rules (per platform, rule-based)

| Platform | Target windows (user local time) |
|---|---|
| LinkedIn | Tue–Thu, 8–10am or 12–1pm |
| Substack articles | Tue or Thu, 7–9am |
| Substack notes | Mon/Wed/Fri, morning or midday |

- **Jitter:** scheduled time randomized ±20–40 min within window (anti-bot-pattern)
- **Spacing:** configurable minimum gap between posts on same channel (default: 18hr)
- **Override:** manual drag or "Publish Now" available from queue view

### Daemon Publish Loop

```
node-cron: every 1 minute
  → query publish_queue WHERE scheduled_for <= now AND status = 'queued'
  → for each: call platform publisher, update status
  → on failure: retry up to 3x (exponential backoff: 5min, 15min, 45min)
  → after 3 failures: mark as 'failed', surface in UI
```

### Kubernetes CronJobs

| Job | Schedule | What it does |
|---|---|---|
| `research-runner` | Every 6 hours (configurable per channel) | Runs full research pipeline for each channel |
| `daily-summary` | Daily at 8am | Generates: posts published yesterday, AI spend, topics in backlog |

---

## Publishing Integrations

### Substack
- Library: `substack-api` (npm package by jakub-k-slys)
- Auth: Substack session cookies, stored AES-256 encrypted in Postgres
- Operations: create note, create article draft, publish article
- Content format: Markdown for articles, plain text for notes

### LinkedIn
- Auth: OAuth 2.0 (`w_member_social` scope)
- Setup: one-time OAuth flow during channel creation (requires LinkedIn Developer App)
- Operations: create text post via `ugcPosts` API endpoint
- Content format: plain text with line breaks (LinkedIn does not render Markdown)
- Token storage: AES-256 encrypted in Postgres, auto-refreshed

### Credential Security
- All tokens, cookies, and secrets: AES-256 encrypted at rest
- Encryption key: injected via environment variable (`ENCRYPTION_KEY`)
- Never included in logs, audit records, or error messages

---

## AI Audit Log

Every AI call throughout the system writes a record to `ai_audit_log`:

```
operation:          what triggered the call
model:              e.g. claude-sonnet-4-6
prompt_tokens:      input token count
completion_tokens:  output token count
cost_usd:           calculated from Anthropic pricing
channel_id:         which channel this is for (if applicable)
entity_type/id:     what entity this call produced or related to
created_at:         timestamp
```

The Channel Dashboard surfaces: total cost this month, cost per draft, cost per research run. This gives full visibility into AI spend.

---

## Security

- No public internet exposure — accessed via local network IP on Mac Mini
- Single-user system — no authentication required for v1 (private network only)
- All credentials encrypted at rest (AES-256)
- No sensitive data in logs or audit records
- Docker/k8s secrets for environment variables (never hardcoded)

---

## Phased Rollout (v1 scope)

| Phase | What ships |
|---|---|
| 1 — Foundation | Docker Compose setup, Postgres schema, Drizzle migrations, project skeleton (Next.js + daemon) |
| 2 — Channels | Channel CRUD, voice onboarding (all 3 methods), channel dashboard shell |
| 3 — Research | Research engine (all 4 sources), AI analysis + ranking, topics backlog UI |
| 4 — Generation | Draft generation pipeline, regeneration with notes, AI audit logging |
| 5 — Review UI | Draft review cards, approve/reject/edit/regenerate, publish queue timeline |
| 6 — Scheduling | Auto-scheduling logic, jitter, spacing, daemon publish loop |
| 7 — Publishing | Substack integration, LinkedIn OAuth + publishing |
| 8 — K8s | Helm chart, k3s manifests, CronJob resources, deployment to Mac Mini |

---

## Open Questions / Future Scope

- Analytics integration (LinkedIn post impressions, Substack open rates) for smarter scheduling in v2
- Remote access via Tailscale or Cloudflare Tunnel (out of scope for v1)
- Multi-user support (out of scope — intentionally single-user)
- Mobile review interface (out of scope for v1)
