# Codebase Structure

**Analysis Date:** 2026-02-26

## Directory Layout

```
.worktrees/build/
├── src/
│   ├── app/                          # Next.js App Router + API routes
│   │   ├── layout.tsx                # Root HTML layout
│   │   ├── page.tsx                  # Home → redirect to /channels
│   │   ├── (app)/                    # Auth group (future: add auth middleware)
│   │   │   ├── layout.tsx            # App layout with SideNav
│   │   │   ├── channels/             # Channel management pages
│   │   │   │   ├── page.tsx          # List/create channels
│   │   │   │   └── new/page.tsx      # Channel creation form
│   │   │   ├── drafts/page.tsx       # Draft review interface (client-side filtering)
│   │   │   ├── queue/page.tsx        # Publishing queue timeline
│   │   │   └── audit/page.tsx        # AI spend audit log viewer
│   │   └── api/                      # HTTP API endpoints
│   │       ├── channels/             # Channel CRUD + detail
│   │       │   ├── route.ts          # GET all, POST create
│   │       │   └── [id]/route.ts     # GET/PUT/DELETE single
│   │       ├── drafts/               # Draft CRUD + lifecycle
│   │       │   ├── route.ts          # GET (with filters), POST (generate)
│   │       │   └── [id]/
│   │       │       ├── approve/route.ts
│   │       │       └── reject/route.ts
│   │       ├── queue/                # Publishing queue management
│   │       │   ├── route.ts          # GET all, POST (manual schedule)
│   │       │   └── [id]/
│   │       │       ├── publish-now/route.ts
│   │       │       └── retry/route.ts
│   │       ├── research/route.ts     # Trigger research pipeline (fire & forget)
│   │       └── voice/route.ts        # Analyze voice profile from samples
│   │
│   ├── components/                   # React components (presentational + smart)
│   │   ├── ui/                       # Shadcn UI primitives (button, card, form, etc.)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── form.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── select.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── textarea.tsx
│   │   ├── channels/                 # Channel-specific UI
│   │   │   ├── ChannelCard.tsx       # Channel summary card (list view)
│   │   │   ├── CreateChannelForm.tsx # Form for channel creation
│   │   │   └── VoiceWizard.tsx       # Multi-step voice profile wizard
│   │   ├── drafts/                   # Draft review & publication UI
│   │   │   ├── DraftsClientShell.tsx # Client-side state + filtering
│   │   │   ├── DraftCard.tsx         # Summary card (list view)
│   │   │   └── DraftDetailPanel.tsx  # Full content + actions (approve/reject/regenerate)
│   │   ├── queue/                    # Publishing queue visualization
│   │   │   ├── QueueItem.tsx         # Single queue item display
│   │   │   └── QueueTimeline.tsx     # Timeline of all scheduled publications
│   │   └── layout/
│   │       └── SideNav.tsx           # Navigation sidebar (Channels, Drafts, Queue, Audit)
│   │
│   ├── lib/                          # Business logic, utilities, integrations
│   │   ├── ai/                       # AI/Claude integration
│   │   │   ├── client.ts             # Anthropic SDK wrapper + model list
│   │   │   └── audit.ts              # AI call logging to database
│   │   ├── generation/               # Draft generation pipeline
│   │   │   └── generator.ts          # Prompt building + Claude call + response parsing
│   │   ├── publishing/               # Multi-platform publishing
│   │   │   ├── queue-runner.ts       # Main loop: fetch due items, dispatch, retry
│   │   │   ├── scheduler.ts          # Schedule calculations (timezone, jitter, windows)
│   │   │   ├── substack.ts           # Substack-specific adapter
│   │   │   └── linkedin.ts           # LinkedIn-specific adapter (in progress)
│   │   ├── research/                 # Research signal sources + aggregation
│   │   │   ├── orchestrator.ts       # Parallel source runner + deduplication
│   │   │   ├── engine.ts             # Full pipeline: load config, run sources, rank with Claude
│   │   │   ├── exa.ts                # Exa API search adapter
│   │   │   ├── reddit.ts             # Reddit subreddit scraper
│   │   │   ├── substack-monitor.ts   # Substack feed RSS parser
│   │   │   └── brainstorm.ts         # AI-powered topic generator
│   │   ├── voice/                    # Voice profile extraction & application
│   │   │   ├── analyzer.ts           # Claude-based voice analysis from samples
│   │   │   └── assembler.ts          # Persona prompt builder from profile
│   │   ├── crypto.ts                 # AES-256 encryption for credentials
│   │   └── utils.ts                  # Shared utilities (date formatting, etc.)
│   │
│   ├── db/                           # Database layer (Drizzle ORM)
│   │   ├── client.ts                 # Drizzle instance + connection pooling
│   │   ├── schema.ts                 # All table definitions + type interfaces
│   │   └── migrations/               # Auto-generated Drizzle migrations
│   │
│   ├── daemon/                       # Background daemon process
│   │   └── index.ts                  # Cron-based publish queue runner
│   │
│   ├── jobs/                         # One-shot job runners
│   │   ├── publish.ts                # Manual publish queue drain
│   │   └── research.ts               # Manual research trigger
│   │
│   └── types/                        # Global TypeScript definitions (if any)
│
├── tests/                            # Test files (mirror src/ structure)
│   ├── api/
│   │   ├── channels.test.ts
│   │   └── voice.test.ts
│   ├── daemon/
│   │   └── daemon.test.ts
│   ├── db/
│   │   └── schema.test.ts
│   ├── lib/
│   │   ├── ai/audit.test.ts
│   │   ├── crypto.test.ts
│   │   ├── generation/generator.test.ts
│   │   ├── publishing/
│   │   │   ├── linkedin.test.ts
│   │   │   ├── scheduler.test.ts
│   │   │   └── substack.test.ts
│   │   ├── research/
│   │   │   ├── engine.test.ts
│   │   │   ├── exa.test.ts
│   │   │   ├── orchestrator.test.ts
│   │   │   ├── reddit.test.ts
│   │   │   └── substack-monitor.test.ts
│   │   └── voice/
│   │       ├── analyzer.test.ts
│   │       └── assembler.test.ts
│
├── public/                           # Static assets (images, icons)
├── docker/                           # Docker configuration
├── docs/                             # Architecture & documentation
├── package.json                      # Dependencies + npm scripts
├── tsconfig.json                     # TypeScript compiler options
├── next.config.ts                    # Next.js configuration
├── drizzle.config.ts                 # Drizzle ORM migrations config
└── vitest.config.ts                  # Test runner configuration
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router pages and API endpoints
- Contains: Server-side pages (RSC), API route handlers
- Key files: `layout.tsx` (root), `page.tsx` (redirects home)

**`src/app/(app)/`:**
- Purpose: Authenticated app routes (route group)
- Contains: Main UI pages for channels, drafts, queue, audit
- Key files: `layout.tsx` (wraps with SideNav)

**`src/app/api/`:**
- Purpose: RESTful HTTP API endpoints
- Contains: Request handlers for channels, drafts, queue, research, voice analysis
- Pattern: Each endpoint validates input, calls business logic, returns JSON

**`src/components/`:**
- Purpose: React UI components (split by domain/layer)
- Contains: Shadcn UI primitives, domain-specific forms, cards, panels
- Pattern: `'use client'` for interactive components, server components for layouts

**`src/lib/`:**
- Purpose: Domain-specific business logic, separated by concern
- Contains: AI integration, generation, publishing, research, voice, crypto
- Pattern: Pure functions where possible, database access only via imported `db` client

**`src/lib/ai/`:**
- Purpose: Claude/Anthropic integration
- Contains: Model wrapper, audit logging
- Key files: `client.ts` (callClaude function), `audit.ts` (logAiCall function)

**`src/lib/generation/`:**
- Purpose: Draft generation from research + persona
- Contains: Prompt builders, Claude calls, response validation
- Key files: `generator.ts` (buildGenerationPrompt, generateDraft)

**`src/lib/publishing/`:**
- Purpose: Multi-platform content publishing
- Contains: Queue runner, platform adapters, scheduling logic
- Key files: `queue-runner.ts` (runPublishQueue), `substack.ts`, `linkedin.ts`

**`src/lib/research/`:**
- Purpose: Content research signal sources + aggregation
- Contains: Adapters (Exa, Reddit, Substack), orchestrator, AI ranking
- Key files: `orchestrator.ts` (parallel runner), `engine.ts` (full pipeline)

**`src/lib/voice/`:**
- Purpose: Voice profile extraction and application
- Contains: Claude-based analysis, persona prompt building
- Key files: `analyzer.ts` (extractVoiceProfile), `assembler.ts` (buildPersonaPrompt)

**`src/db/`:**
- Purpose: Database access layer (Drizzle ORM)
- Contains: Schema definitions, connection pool, type exports
- Key files: `schema.ts` (all table + type definitions), `client.ts` (db instance)

**`src/daemon/`:**
- Purpose: Long-running background process
- Contains: Cron-scheduled queue runner
- Key files: `index.ts` (schedule, tick loop)

**`src/jobs/`:**
- Purpose: One-shot job runners
- Contains: Manual research trigger, queue drain
- Key files: `research.ts`, `publish.ts`

**`tests/`:**
- Purpose: Unit and integration tests
- Contains: Test files matching `src/` structure
- Naming: `*.test.ts` files

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root HTML wrapper
- `src/app/(app)/layout.tsx`: App shell with sidebar
- `src/daemon/index.ts`: Background publish queue runner
- `src/jobs/research.ts`: Manual research job entry point

**Configuration:**
- `tsconfig.json`: TypeScript paths (`@/*` → `src/*`)
- `next.config.ts`: Next.js build config
- `drizzle.config.ts`: Database migration config
- `.env.example`: Required environment variables

**Core Logic:**
- `src/db/schema.ts`: All table + type definitions (channels, drafts, publishQueue, etc.)
- `src/db/client.ts`: Drizzle ORM instance + connection pooling
- `src/lib/generation/generator.ts`: Draft generation with Claude
- `src/lib/research/engine.ts`: Full research pipeline (sources → topics)
- `src/lib/publishing/queue-runner.ts`: Scheduled publishing orchestrator

**Testing:**
- `vitest.config.ts`: Vitest runner configuration
- `tests/lib/ai/audit.test.ts`: AI logging tests
- `tests/lib/publishing/queue-runner.test.ts`: Queue runner retry logic tests

## Naming Conventions

**Files:**
- React components: `PascalCase.tsx` (e.g., `DraftCard.tsx`, `CreateChannelForm.tsx`)
- Non-component modules: `camelCase.ts` (e.g., `generator.ts`, `queue-runner.ts`)
- API routes: `route.ts` in Next.js directory structure

**Directories:**
- Feature/domain: `kebab-case` or descriptive plural (e.g., `src/components/channels/`, `src/lib/publishing/`)
- Logical groups: lowercase (e.g., `src/db/`, `src/lib/`)

**Functions:**
- Async business logic: `verb` + `Noun` (e.g., `generateDraft`, `runPublishQueue`, `searchExa`)
- Pure calculations: `build` + `Noun` (e.g., `buildGenerationPrompt`, `buildAnalysisPrompt`)
- Utilities: `verb` + optional object (e.g., `decrypt`, `formatForSubstack`)

**Types & Interfaces:**
- Database row types: `*Row` or inferred via `$inferSelect` (e.g., `DraftRow`, `ChannelRow`)
- Request/response: `*Input`, `*Output`, `*Result` (e.g., `GenerationInput`, `GeneratedDraft`, `SubstackPublishResult`)
- Domain models: PascalCase (e.g., `Channel`, `Draft`, `VoiceProfile`)

**Constants:**
- Environment vars: `UPPER_SNAKE_CASE` (e.g., `ANTHROPIC_API_KEY`, `DATABASE_URL`)
- Enum values: lowercase (e.g., `platform: 'linkedin' | 'substack'`, `status: 'pending_review'`)

## Where to Add New Code

**New Feature:**
- Primary code: Create under appropriate `src/lib/` subdomain (e.g., new platform adapter → `src/lib/publishing/platform-x.ts`)
- API endpoint: Add route in `src/app/api/` with Next.js file structure
- UI pages: Add under `src/app/(app)/` with route group structure
- Tests: Add mirror structure in `tests/` (e.g., `tests/lib/publishing/platform-x.test.ts`)

**New Component/Module:**
- UI components: Add to `src/components/` organized by feature (e.g., `src/components/queue/`)
- Business logic: Add to `src/lib/` organized by domain
- Database changes: Modify `src/db/schema.ts`, auto-generate migration via `npm run db:generate`

**Utilities:**
- Shared helpers: Add to `src/lib/utils.ts` for general utilities
- Domain-specific helpers: Keep in domain folder (e.g., scheduler helpers stay in `src/lib/publishing/scheduler.ts`)
- Types: Define inline in schema or module that uses them; export if shared

**Database Schema Changes:**
1. Edit `src/db/schema.ts` (tables, enums, interfaces)
2. Run `npm run db:generate` to auto-create migration file in `src/db/migrations/`
3. Run `npm run db:migrate` to apply to development database

## Special Directories

**`src/db/migrations/`:**
- Purpose: Drizzle ORM auto-generated SQL migrations
- Generated: Yes (via `npm run db:generate`)
- Committed: Yes (to version control)
- Never edit manually — regenerate via `npm run db:generate` if needed

**`.next/`:**
- Purpose: Next.js build artifacts and development server cache
- Generated: Yes (via `npm run build` or `npm run dev`)
- Committed: No (in `.gitignore`)
- Safe to delete — rebuilds on next run

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes (via `npm install`)
- Committed: No
- Never edit manually — use `npm install`/`npm update`

**`public/`:**
- Purpose: Static assets (images, SVGs, fonts)
- Location: Served at `https://app.com/filename`
- Never delete favicon or manifest files without updating HTML

---

*Structure analysis: 2026-02-26*
