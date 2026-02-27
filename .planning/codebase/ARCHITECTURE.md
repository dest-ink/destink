# Architecture

**Analysis Date:** 2026-02-26

## Pattern Overview

**Overall:** Full-stack Next.js application with distributed, loosely-coupled research → generation → publishing pipeline.

**Key Characteristics:**
- Content creation automation driven by multi-source research
- AI-powered generation with voice cloning (persona matching)
- Platform-agnostic publishing abstraction (LinkedIn, Substack)
- Background jobs via daemon loop and on-demand job runners
- Event-driven research → draft → queue flow
- Centralized AI audit logging for cost/usage tracking

## Layers

**Presentation (Frontend):**
- Purpose: React components for user interaction, channel/draft/queue management
- Location: `src/app/(app)/` (page routes), `src/components/`
- Contains: Pages, form components, layouts, UI primitives
- Depends on: API layer (`/api/*`), database schemas via type inference
- Used by: Browser/client requests

**API Layer (Server):**
- Purpose: HTTP endpoints for CRUD operations, async job triggers, platform integration
- Location: `src/app/api/`
- Contains: Route handlers for channels, drafts, queue, research, voice, publishing
- Depends on: Database client, business logic (generation, publishing, research)
- Used by: Frontend, daemon, job runners, external webhooks

**Business Logic:**
- Purpose: Core domain operations — research aggregation, draft generation, publishing orchestration
- Location: `src/lib/` (organized by domain)
- Contains:
  - Research: `src/lib/research/` (Exa, Reddit, Substack adapters, topic ranking)
  - Generation: `src/lib/generation/` (prompt building, Claude integration)
  - Publishing: `src/lib/publishing/` (queue runner, platform adapters, scheduler)
  - AI: `src/lib/ai/` (Claude client, audit logging)
  - Voice: `src/lib/voice/` (voice profile analysis and assembly)
- Depends on: Database, AI client, external APIs
- Used by: API routes, daemon, job runners

**Persistence:**
- Purpose: Schema definition and database access
- Location: `src/db/schema.ts`, `src/db/client.ts`
- Contains: Drizzle ORM tables, types, JSON column definitions
- Depends on: PostgreSQL, pg client library
- Used by: All business logic and API routes

**Daemons & Jobs:**
- Purpose: Background work outside HTTP request/response cycles
- Location: `src/daemon/index.ts`, `src/jobs/publish.ts`, `src/jobs/research.ts`
- Contains: Scheduled tasks, job entry points
- Depends on: Business logic, database
- Used by: Kubernetes CronJob, one-shot runners, or process schedulers

## Data Flow

**Research → Draft → Publish Pipeline:**

1. **Research Phase** (`POST /api/research`)
   - User triggers research for a channel via API or UI
   - Request immediately returns, executes in background
   - `runResearchForChannel()` loads channel config + recent drafts + voice profile
   - Runs 4 signal sources in parallel:
     - Exa API search
     - Reddit subreddit scraping
     - Substack feed monitoring
     - AI-powered brainstorming
   - Claude (haiku) ranks sources into TopicRecommendation array
   - Results stored in `researchRuns` table with all metadata

2. **Draft Generation** (`POST /api/drafts`)
   - User selects topic recommendation from research results
   - Sends: channelId, contentType, topicTitle, topicAngle, sources, optional regenerationNote
   - `generateDraft()` calls Claude (sonnet-4-6) with:
     - Persona prompt from channel
     - Topic title + angle from research
     - Source material for context
     - Recent draft titles to avoid repetition
   - Claude returns JSON: headlineOptions[], hook, body, cta, voiceConfidence (0-100)
   - Draft stored in `drafts` table with status: "pending_review"
   - User reviews, edits headline/body, approves or rejects

3. **Publishing Phase** (`PUT /api/drafts/[id]/approve`)
   - User approves draft or requests regeneration
   - Approved drafts move to status: "approved"
   - User schedules for publication via UI → creates `publishQueue` row
   - Daemon or CronJob polls queue every minute
   - `runPublishQueue()` finds all items where `scheduledFor <= now`
   - Dispatches to platform-specific publisher:
     - Substack: formats as note + calls SubstackClient API
     - LinkedIn: (integration in progress)
   - Updates queue status: "queued" → "publishing" → "published" (or retries with backoff)
   - Marks draft status: "published"

**State Management:**
- Channel state: `channels` table (credentials, persona, research config)
- Voice profile state: `voiceProfiles` table (extracted toneDescriptors, patterns, themes)
- Draft lifecycle: `drafts` table (pending_review → approved/rejected → published)
- Queue lifecycle: `publishQueue` table (queued → publishing → published/failed)
- Audit trail: `aiAuditLog` table (every Claude call logged with tokens + cost)

## Key Abstractions

**Channel:**
- Purpose: Represents a content destination (LinkedIn account, Substack publication)
- Location: `src/db/schema.ts` (channels table definition)
- Pattern: Config holder — stores platform, credentials, persona, research/schedule configs
- Example: `{ name: "My Newsletter", platform: "substack", personaPrompt: "...", researchConfig: {...}}`

**Voice Profile:**
- Purpose: Extracted writing style from user samples
- Location: `src/lib/voice/analyzer.ts`
- Pattern: Analyzed via Claude → stored in `voiceProfiles` table as JSONB
- Used by: Generation prompt building to ensure persona match

**Research Source:**
- Purpose: Discovered content opportunity with URL, title, summary
- Location: `src/db/schema.ts` (ResearchSource interface)
- Pattern: Immutable record from external source (Exa, Reddit, Substack, brainstorm)
- Contains: URL, title, summary, source origin

**Topic Recommendation:**
- Purpose: Ranked content opportunity with suggested angle
- Location: `src/db/schema.ts` (TopicRecommendation interface)
- Pattern: Output of research analysis — Claude's ranking of sources into opportunities
- Contains: title, angle, whyTimely, relevanceScore, contentType, associated sources

**Draft:**
- Purpose: Generated content ready for review/publication
- Location: `src/db/schema.ts` (drafts table)
- Pattern: Mutable record with status lifecycle
- Contains: content (hook, body, cta), metadata (voiceConfidence, researchSources, model used)

**PublishQueue Item:**
- Purpose: Scheduled publication task
- Location: `src/db/schema.ts` (publishQueue table)
- Pattern: Time-based task with retry logic
- Lifecycle: queued → publishing → published (or failed with exponential backoff)

## Entry Points

**Web Server:**
- Location: `src/app/layout.tsx` → `src/app/(app)/layout.tsx`
- Triggers: HTTP requests to `/` and `/channels/*`, `/api/*`
- Responsibilities: Layout structure, route matching, API handler dispatch

**Daemon (Background Publishing Loop):**
- Location: `src/daemon/index.ts`
- Triggers: Started as separate process (e.g., `npm run dev:daemon`)
- Responsibilities: Check publish queue every minute, orchestrate platform publishing
- Safety: In-process `isProcessing` flag + per-item locking prevents overlapping runs

**Job Runners (One-Shot):**
- Location: `src/jobs/publish.ts`, `src/jobs/research.ts`
- Triggers: Manual invocation via `npm run job:publish` or Kubernetes CronJob
- Responsibilities: Execute single research run or drain publish queue

**API Routes:**
- Location: `src/app/api/*/route.ts`
- Triggers: HTTP POST/GET/PUT/DELETE requests
- Responsibilities: Input validation, call business logic, return JSON responses

## Error Handling

**Strategy:** Layered — per-source failures are caught; per-item failures are logged and retried; critical infrastructure failures propagate.

**Patterns:**

- **Research Adapters:** Each source (Exa, Reddit, Substack) wrapped in try/catch. Failures logged but don't stop other sources. `Promise.allSettled` combines results. (`src/lib/research/orchestrator.ts`)

- **AI Calls:** Always log audit trail even on failure. Claude response parsing failures throw loudly — invalid JSON is a programming error. (`src/lib/ai/client.ts`)

- **Publishing Retries:** Per-item exponential backoff: 5 min → 15 min → 45 min, max 3 attempts. After max retries, item marked "failed" with error message. Failed items don't block queue progress. (`src/lib/publishing/queue-runner.ts`)

- **Credential Decryption:** Throws if missing env var, key mismatch, or tampered data. Caller must handle — platform publishing fails loudly. (`src/lib/publishing/substack.ts`)

- **API Validation:** Input validation throws 400 Bad Request. Database errors throw 500 Internal Server Error. (`src/app/api/drafts/route.ts`)

## Cross-Cutting Concerns

**Logging:** Console-based. All major operations log to `stdout` with context prefixes: `[daemon]`, `[queue-runner]`, `[research]`, `[api/*]`. Structured logging not implemented — suitable for single-instance deployment; multi-instance would need JSON logs + aggregation.

**Validation:**
- Input: JSON schema validation via type guards in API routes
- Database: Drizzle ORM provides type safety; enums prevent invalid states
- AI: JSON parsing + structural guards after Claude calls
- Credentials: Shape validation after decryption

**Authentication:** Not implemented. Assumes single-user or trusted environment (no auth on API routes). UI runs in browser; all API access is client-side.

**Encryption:** Channel credentials encrypted at rest via AES-256 (env key: `CREDENTIALS_ENCRYPTION_KEY`). Decrypt on-demand during publishing. (`src/lib/crypto.ts`)

**AI Cost Tracking:** Every Claude call logged to `aiAuditLog` table with model, input/output tokens, estimated cost. Allows auditing spending per operation, channel, or date. (`src/lib/ai/audit.ts`)

**Concurrency:**
- Daemon: In-process flag prevents overlapping queue runs
- Database: Drizzle transactions not used; relies on atomic updates + database-level constraints
- API: Stateless — no request serialization, concurrent requests OK
- Research: Parallel source execution via `Promise.all`

---

*Architecture analysis: 2026-02-26*
