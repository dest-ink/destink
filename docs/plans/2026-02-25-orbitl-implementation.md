# Destink Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a self-hosted personal content automation platform that researches topics, generates drafts in your voice, and publishes to Substack and LinkedIn on a smart schedule — with human approval required before anything goes live.

**Architecture:** Next.js 15 (App Router) for the UI and API routes; a Node.js daemon for the live publish loop; Kubernetes CronJobs for scheduled research runs; all sharing a Postgres database via Drizzle ORM. Deployed via Docker Compose for local dev and a Helm chart to a k3s cluster on Mac Mini.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Drizzle ORM, PostgreSQL, Anthropic SDK (claude-sonnet-4-6 / claude-haiku-4-5), Exa API, Reddit API, substack-api npm package, LinkedIn API v2, node-cron, Vitest, Docker Compose, k3s, Helm

---

## Project Structure

```
destink/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── api/
│   │   │   ├── channels/route.ts
│   │   │   ├── channels/[id]/route.ts
│   │   │   ├── drafts/route.ts
│   │   │   ├── drafts/[id]/route.ts
│   │   │   ├── drafts/[id]/approve/route.ts
│   │   │   ├── drafts/[id]/reject/route.ts
│   │   │   ├── drafts/[id]/regenerate/route.ts
│   │   │   ├── queue/route.ts
│   │   │   ├── queue/[id]/route.ts
│   │   │   ├── research/route.ts
│   │   │   ├── voice/route.ts
│   │   │   └── audit/route.ts
│   │   ├── (app)/
│   │   │   ├── channels/page.tsx
│   │   │   ├── channels/new/page.tsx
│   │   │   ├── channels/[id]/page.tsx
│   │   │   ├── drafts/page.tsx
│   │   │   ├── queue/page.tsx
│   │   │   └── audit/page.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── db/
│   │   ├── schema.ts               # Drizzle table definitions
│   │   └── client.ts               # db connection singleton
│   ├── lib/
│   │   ├── crypto.ts               # AES-256 encrypt/decrypt
│   │   ├── ai/
│   │   │   ├── client.ts           # Anthropic SDK wrapper
│   │   │   └── audit.ts            # AI audit log writer
│   │   ├── research/
│   │   │   ├── exa.ts              # Exa web search adapter
│   │   │   ├── reddit.ts           # Reddit API adapter
│   │   │   ├── substack-monitor.ts # Substack feed monitor
│   │   │   ├── brainstorm.ts       # Claude brainstorm adapter
│   │   │   └── engine.ts           # Orchestrates all 4 sources
│   │   ├── generation/
│   │   │   ├── context-builder.ts  # Assembles generation prompt
│   │   │   └── generator.ts        # Calls Claude, returns draft
│   │   ├── publishing/
│   │   │   ├── scheduler.ts        # Assigns scheduled_for times
│   │   │   ├── substack.ts         # Substack publisher
│   │   │   └── linkedin.ts         # LinkedIn publisher
│   │   └── voice/
│   │       ├── analyzer.ts         # Claude voice extraction
│   │       └── assembler.ts        # Assembles persona_prompt from profiles
│   ├── components/
│   │   ├── ui/                     # shadcn components
│   │   ├── channels/
│   │   ├── drafts/
│   │   ├── queue/
│   │   └── layout/
│   ├── daemon/
│   │   └── index.ts                # node-cron publish loop
│   └── types/
│       └── index.ts                # shared TypeScript types
├── jobs/
│   ├── research-runner.ts          # K8s CronJob entry point
│   └── daily-summary.ts            # K8s CronJob entry point
├── tests/
│   ├── lib/
│   │   ├── crypto.test.ts
│   │   ├── research/
│   │   ├── generation/
│   │   └── publishing/
│   └── api/
├── docker/
│   ├── Dockerfile.web
│   ├── Dockerfile.daemon
│   └── Dockerfile.jobs
├── helm/
│   └── destink/
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
├── docker-compose.yml
├── drizzle.config.ts
├── vitest.config.ts
├── tsconfig.json
├── next.config.ts
└── package.json
```

---

## Phase 1: Foundation

### Task 1.1: Initialize project with correct dependencies

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `drizzle.config.ts`
- Create: `vitest.config.ts`
- Create: `.env.example`

**Step 1: Bootstrap Next.js project**

```bash
cd /Users/dknell/Projects/destink
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-turbopack
```

Expected: Next.js project created with src/app/ structure.

**Step 2: Install core dependencies**

```bash
npm install drizzle-orm pg @anthropic-ai/sdk
npm install -D drizzle-kit @types/pg vitest @vitejs/plugin-react vite-tsconfig-paths
npm install node-cron @types/node-cron
npm install substack-api
npm install @exa-ai/search   # or exa-js — verify package name at npmjs.com
npm install next-themes       # for dark mode later
```

**Step 3: Create `.env.example`**

```bash
# Database
DATABASE_URL=postgresql://destink:destink@localhost:5432/destink

# Encryption (32-byte hex key: openssl rand -hex 32)
ENCRYPTION_KEY=

# AI
ANTHROPIC_API_KEY=

# Research
EXA_API_KEY=
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=http://localhost:3021/api/auth/linkedin/callback

# App
NEXT_PUBLIC_APP_URL=http://localhost:3021
PORT=3021
```

**Step 4: Copy `.env.example` to `.env.local`**

```bash
cp .env.example .env.local
```

**Step 5: Configure `drizzle.config.ts`**

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

**Step 6: Configure `vitest.config.ts`**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: { reporter: ['text', 'html'] },
  },
});
```

**Step 7: Update `next.config.ts` to use port 3021**

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: { serverActions: { allowedOrigins: ['localhost:3021'] } },
};

export default nextConfig;
```

Add to `package.json` scripts:
```json
{
  "scripts": {
    "dev": "next dev -p 3021",
    "dev:daemon": "tsx watch src/daemon/index.ts",
    "dev:all": "concurrently \"npm run dev\" \"npm run dev:daemon\"",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Install `concurrently` and `tsx`:
```bash
npm install -D concurrently tsx
```

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js project with dependencies and config"
```

---

### Task 1.2: Docker Compose setup

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.override.yml`
- Create: `docker/Dockerfile.web`
- Create: `docker/Dockerfile.daemon`
- Create: `docker/Dockerfile.jobs`

**Step 1: Create `docker-compose.yml`**

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: destink
      POSTGRES_PASSWORD: destink
      POSTGRES_DB: destink
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U destink"]
      interval: 5s
      timeout: 5s
      retries: 5

  web:
    build:
      context: .
      dockerfile: docker/Dockerfile.web
    ports:
      - "3021:3021"
    environment:
      DATABASE_URL: postgresql://destink:destink@db:5432/destink
    env_file: .env.local
    depends_on:
      db:
        condition: service_healthy

  daemon:
    build:
      context: .
      dockerfile: docker/Dockerfile.daemon
    environment:
      DATABASE_URL: postgresql://destink:destink@db:5432/destink
    env_file: .env.local
    depends_on:
      db:
        condition: service_healthy

volumes:
  postgres_data:
```

**Step 2: Create `docker/Dockerfile.web`**

```dockerfile
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3021
CMD ["npm", "start", "--", "-p", "3021"]
```

**Step 3: Create `docker/Dockerfile.daemon`**

```dockerfile
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npx", "tsx", "src/daemon/index.ts"]
```

**Step 4: Create `docker/Dockerfile.jobs`**

```dockerfile
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Entry point set via CMD in k8s CronJob spec
```

**Step 5: Add `.dockerignore`**

```
node_modules
.next
.git
.env.local
*.test.ts
```

**Step 6: Verify Postgres starts**

```bash
docker compose up db -d
# Wait ~5 seconds, then:
docker compose ps
```

Expected: `db` service is healthy.

**Step 7: Commit**

```bash
git add docker-compose.yml docker/ .dockerignore
git commit -m "feat: add Docker Compose and Dockerfiles for web/daemon/jobs"
```

---

### Task 1.3: Database schema and migrations

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/client.ts`
- Create: `src/types/index.ts`

**Step 1: Write the failing test for db client**

```typescript
// tests/db/client.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/db/client';
import { channels } from '@/db/schema';

describe('db client', () => {
  it('connects to postgres and channels table exists', async () => {
    const result = await db.select().from(channels).limit(1);
    expect(Array.isArray(result)).toBe(true);
  });
});
```

**Step 2: Run test to confirm it fails**

```bash
npm test tests/db/client.test.ts
```

Expected: FAIL — `@/db/client` not found.

**Step 3: Create `src/db/schema.ts`**

```typescript
// src/db/schema.ts
import {
  pgTable, pgEnum, uuid, text, integer, jsonb,
  timestamptz, numeric
} from 'drizzle-orm/pg-core';

export const platformEnum = pgEnum('platform', ['linkedin', 'substack']);
export const voiceMethodEnum = pgEnum('voice_method', ['archive', 'samples', 'wizard']);
export const contentTypeEnum = pgEnum('content_type', ['note', 'article']);
export const draftStatusEnum = pgEnum('draft_status', [
  'pending_review', 'approved', 'rejected', 'published'
]);
export const queueStatusEnum = pgEnum('queue_status', [
  'queued', 'publishing', 'published', 'failed'
]);

export const channels = pgTable('channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  platform: platformEnum('platform').notNull(),
  platformId: text('platform_id'),
  personaPrompt: text('persona_prompt'),
  researchConfig: jsonb('research_config').$type<ResearchConfig>(),
  scheduleConfig: jsonb('schedule_config').$type<ScheduleConfig>(),
  credentials: text('credentials'), // AES-256 encrypted JSON
  createdAt: timestamptz('created_at').defaultNow().notNull(),
  updatedAt: timestamptz('updated_at').defaultNow().notNull(),
});

export const voiceProfiles = pgTable('voice_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').references(() => channels.id, { onDelete: 'cascade' }).notNull(),
  method: voiceMethodEnum('method').notNull(),
  rawInput: text('raw_input'),
  extractedProfile: jsonb('extracted_profile').$type<VoiceProfile>(),
  createdAt: timestamptz('created_at').defaultNow().notNull(),
  updatedAt: timestamptz('updated_at').defaultNow().notNull(),
});

export const drafts = pgTable('drafts', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').references(() => channels.id, { onDelete: 'cascade' }).notNull(),
  researchRunId: uuid('research_run_id'),
  contentType: contentTypeEnum('content_type').notNull(),
  title: text('title'),
  headlineOptions: jsonb('headline_options').$type<string[]>(),
  hook: text('hook'),
  body: text('body'),
  cta: text('cta'),
  voiceConfidence: integer('voice_confidence'),
  researchSources: jsonb('research_sources').$type<ResearchSource[]>(),
  aiModel: text('ai_model'),
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  status: draftStatusEnum('status').default('pending_review').notNull(),
  rejectionReason: text('rejection_reason'),
  regenerationNote: text('regeneration_note'),
  createdAt: timestamptz('created_at').defaultNow().notNull(),
  updatedAt: timestamptz('updated_at').defaultNow().notNull(),
});

export const publishQueue = pgTable('publish_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  draftId: uuid('draft_id').references(() => drafts.id).notNull(),
  channelId: uuid('channel_id').references(() => channels.id).notNull(),
  scheduledFor: timestamptz('scheduled_for').notNull(),
  publishedAt: timestamptz('published_at'),
  platformResponse: jsonb('platform_response'),
  status: queueStatusEnum('status').default('queued').notNull(),
  retryCount: integer('retry_count').default(0).notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamptz('created_at').defaultNow().notNull(),
});

export const researchRuns = pgTable('research_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').references(() => channels.id).notNull(),
  sourcesSearched: jsonb('sources_searched'),
  topicsFound: jsonb('topics_found').$type<TopicRecommendation[]>(),
  draftsGenerated: jsonb('drafts_generated').$type<string[]>(),
  aiModel: text('ai_model'),
  tokensUsed: integer('tokens_used'),
  runAt: timestamptz('run_at').defaultNow().notNull(),
});

export const aiAuditLog = pgTable('ai_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  operation: text('operation').notNull(),
  model: text('model').notNull(),
  promptTokens: integer('prompt_tokens').notNull(),
  completionTokens: integer('completion_tokens').notNull(),
  costUsd: numeric('cost_usd', { precision: 10, scale: 6 }),
  channelId: uuid('channel_id'),
  entityType: text('entity_type'),
  entityId: uuid('entity_id'),
  createdAt: timestamptz('created_at').defaultNow().notNull(),
});

// Types for jsonb columns
export interface ResearchConfig {
  topics: string[];
  keywords: string[];
  subreddits: string[];
  substackFeeds: string[];
  searchQueryTemplates: string[];
  excludedDomains: string[];
  contentTypeMix: { note: number; article: number };
  maxDraftsPerRun: number;
  scheduleHours: number; // how often research runs
}

export interface ScheduleConfig {
  timezone: string;
  minGapHours: number;
  timeWindows: {
    dayOfWeek: number[]; // 0=Sun, 1=Mon...
    startHour: number;
    endHour: number;
  }[];
  jitterMinutes: number;
}

export interface VoiceProfile {
  toneDescriptors: string[];
  sentencePatterns: string;
  recurringThemes: string[];
  opinionStances: string[];
  topicsToAvoid: string[];
  vocabularyNotes: string;
  idealReader: string;
}

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

**Step 4: Create `src/db/client.ts`**

```typescript
// src/db/client.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
export type DB = typeof db;
```

**Step 5: Generate and run migration**

```bash
# Ensure db is running
docker compose up db -d

# Generate migration from schema
DATABASE_URL=postgresql://destink:destink@localhost:5432/destink npm run db:generate

# Apply migration
DATABASE_URL=postgresql://destink:destink@localhost:5432/destink npm run db:migrate
```

Expected: Migration files created in `src/db/migrations/`, tables created in Postgres.

**Step 6: Run the test — should pass now**

```bash
DATABASE_URL=postgresql://destink:destink@localhost:5432/destink npm test tests/db/client.test.ts
```

Expected: PASS

**Step 7: Commit**

```bash
git add src/db/ tests/db/ drizzle.config.ts
git commit -m "feat: add database schema, Drizzle client, and initial migration"
```

---

### Task 1.4: Encryption utility

**Files:**
- Create: `src/lib/crypto.ts`
- Create: `tests/lib/crypto.test.ts`

**Step 1: Write failing test**

```typescript
// tests/lib/crypto.test.ts
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '@/lib/crypto';

describe('crypto', () => {
  const key = 'a'.repeat(64); // 32-byte hex

  it('encrypts and decrypts a string', () => {
    const plaintext = 'my-secret-token';
    const ciphertext = encrypt(plaintext, key);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext, key)).toBe(plaintext);
  });

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const a = encrypt('hello', key);
    const b = encrypt('hello', key);
    expect(a).not.toBe(b);
  });

  it('returns null for invalid ciphertext', () => {
    expect(decrypt('invalid', key)).toBeNull();
  });
});
```

**Step 2: Run test — expect failure**

```bash
npm test tests/lib/crypto.test.ts
```

Expected: FAIL — `@/lib/crypto` not found.

**Step 3: Implement `src/lib/crypto.ts`**

```typescript
// src/lib/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // format: iv(12):tag(16):ciphertext
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(ciphertext: string, keyHex: string): string | null {
  try {
    const [ivHex, tagHex, encHex] = ciphertext.split(':');
    const key = Buffer.from(keyHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  } catch {
    return null;
  }
}
```

**Step 4: Run test — expect pass**

```bash
npm test tests/lib/crypto.test.ts
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/lib/crypto.ts tests/lib/crypto.test.ts
git commit -m "feat: add AES-256-GCM encryption utility"
```

---

### Task 1.5: AI client with audit logging

**Files:**
- Create: `src/lib/ai/client.ts`
- Create: `src/lib/ai/audit.ts`
- Create: `tests/lib/ai/audit.test.ts`

**Step 1: Write failing test for audit logger**

```typescript
// tests/lib/ai/audit.test.ts
import { describe, it, expect, vi } from 'vitest';
import { computeCost } from '@/lib/ai/audit';

describe('computeCost', () => {
  it('calculates cost for claude-sonnet-4-6', () => {
    const cost = computeCost('claude-sonnet-4-6', 1000, 500);
    // Sonnet: $3/MTok input, $15/MTok output
    expect(cost).toBeCloseTo(0.003 + 0.0075, 5);
  });

  it('calculates cost for claude-haiku-4-5-20251001', () => {
    const cost = computeCost('claude-haiku-4-5-20251001', 1000, 500);
    // Haiku: $0.80/MTok input, $4/MTok output
    expect(cost).toBeCloseTo(0.0008 + 0.002, 5);
  });
});
```

**Step 2: Run test — expect failure**

```bash
npm test tests/lib/ai/audit.test.ts
```

**Step 3: Implement `src/lib/ai/audit.ts`**

```typescript
// src/lib/ai/audit.ts
import { db } from '@/db/client';
import { aiAuditLog } from '@/db/schema';

// Prices per token (as of 2025, verify at console.anthropic.com/pricing)
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6':          { input: 3 / 1_000_000,  output: 15 / 1_000_000 },
  'claude-haiku-4-5-20251001':  { input: 0.8 / 1_000_000, output: 4 / 1_000_000 },
  'claude-opus-4-6':            { input: 15 / 1_000_000,  output: 75 / 1_000_000 },
};

export function computeCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = PRICING[model] ?? { input: 0, output: 0 };
  return pricing.input * promptTokens + pricing.output * completionTokens;
}

export interface AuditEntry {
  operation: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  channelId?: string;
  entityType?: string;
  entityId?: string;
}

export async function logAiCall(entry: AuditEntry): Promise<void> {
  const costUsd = computeCost(entry.model, entry.promptTokens, entry.completionTokens);
  await db.insert(aiAuditLog).values({
    operation: entry.operation,
    model: entry.model,
    promptTokens: entry.promptTokens,
    completionTokens: entry.completionTokens,
    costUsd: costUsd.toString(),
    channelId: entry.channelId,
    entityType: entry.entityType,
    entityId: entry.entityId,
  });
}
```

**Step 4: Implement `src/lib/ai/client.ts`**

```typescript
// src/lib/ai/client.ts
import Anthropic from '@anthropic-ai/sdk';
import { logAiCall, type AuditEntry } from './audit';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface CallClaudeOptions {
  model: 'claude-sonnet-4-6' | 'claude-haiku-4-5-20251001' | 'claude-opus-4-6';
  system: string;
  prompt: string;
  maxTokens?: number;
  audit: Omit<AuditEntry, 'model' | 'promptTokens' | 'completionTokens'>;
}

export async function callClaude(options: CallClaudeOptions): Promise<string> {
  const { model, system, prompt, maxTokens = 4096, audit } = options;

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: prompt }],
  });

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');

  await logAiCall({
    ...audit,
    model,
    promptTokens: inputTokens,
    completionTokens: outputTokens,
  });

  return content.text;
}
```

**Step 5: Run test — expect pass**

```bash
npm test tests/lib/ai/audit.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/ai/ tests/lib/ai/
git commit -m "feat: add AI client wrapper with audit logging"
```

---

## Phase 2: Channels

### Task 2.1: Channel API routes (CRUD)

**Files:**
- Create: `src/app/api/channels/route.ts`
- Create: `src/app/api/channels/[id]/route.ts`
- Create: `tests/api/channels.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/api/channels.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/db/client';
import { channels } from '@/db/schema';

describe('channels data layer', () => {
  let channelId: string;

  it('inserts a channel', async () => {
    const [ch] = await db.insert(channels).values({
      name: 'Test LinkedIn',
      platform: 'linkedin',
      researchConfig: {
        topics: ['AI', 'startups'],
        keywords: [],
        subreddits: [],
        substackFeeds: [],
        searchQueryTemplates: [],
        excludedDomains: [],
        contentTypeMix: { note: 70, article: 30 },
        maxDraftsPerRun: 3,
        scheduleHours: 6,
      },
      scheduleConfig: {
        timezone: 'America/New_York',
        minGapHours: 18,
        jitterMinutes: 30,
        timeWindows: [{ dayOfWeek: [2, 3, 4], startHour: 8, endHour: 10 }],
      },
    }).returning();

    expect(ch.id).toBeDefined();
    expect(ch.name).toBe('Test LinkedIn');
    channelId = ch.id;
  });

  it('retrieves the channel by id', async () => {
    const [ch] = await db.select().from(channels).where(eq(channels.id, channelId));
    expect(ch.platform).toBe('linkedin');
  });

  afterAll(async () => {
    await db.delete(channels).where(eq(channels.id, channelId));
  });
});
```

**Step 2: Run test (should fail — missing `eq` import)**

```bash
DATABASE_URL=postgresql://destink:destink@localhost:5432/destink npm test tests/api/channels.test.ts
```

Add import to test file: `import { eq } from 'drizzle-orm';`

**Step 3: Implement `src/app/api/channels/route.ts`**

```typescript
// src/app/api/channels/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { channels } from '@/db/schema';

export async function GET() {
  const rows = await db.select().from(channels).orderBy(channels.createdAt);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const [channel] = await db.insert(channels).values({
    name: body.name,
    platform: body.platform,
    platformId: body.platformId,
    researchConfig: body.researchConfig,
    scheduleConfig: body.scheduleConfig,
  }).returning();
  return NextResponse.json(channel, { status: 201 });
}
```

**Step 4: Implement `src/app/api/channels/[id]/route.ts`**

```typescript
// src/app/api/channels/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { channels } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const [channel] = await db.select().from(channels).where(eq(channels.id, params.id));
  if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(channel);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const [updated] = await db.update(channels)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(channels.id, params.id))
    .returning();
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await db.delete(channels).where(eq(channels.id, params.id));
  return new NextResponse(null, { status: 204 });
}
```

**Step 5: Run test — expect pass**

```bash
DATABASE_URL=postgresql://destink:destink@localhost:5432/destink npm test tests/api/channels.test.ts
```

**Step 6: Commit**

```bash
git add src/app/api/channels/ tests/api/channels.test.ts
git commit -m "feat: add channel CRUD API routes"
```

---

### Task 2.2: Voice profile — archive + samples pipeline

**Files:**
- Create: `src/lib/voice/analyzer.ts`
- Create: `src/lib/voice/assembler.ts`
- Create: `src/app/api/voice/route.ts`
- Create: `tests/lib/voice/analyzer.test.ts`

**Step 1: Write failing test for voice analyzer**

```typescript
// tests/lib/voice/analyzer.test.ts
import { describe, it, expect, vi } from 'vitest';
import { buildVoiceAnalysisPrompt } from '@/lib/voice/analyzer';

describe('buildVoiceAnalysisPrompt', () => {
  it('includes all sample texts in the prompt', () => {
    const samples = ['Article one content.', 'Article two content.'];
    const prompt = buildVoiceAnalysisPrompt(samples);
    expect(prompt).toContain('Article one content.');
    expect(prompt).toContain('Article two content.');
    expect(prompt).toContain('toneDescriptors');
  });
});
```

**Step 2: Run test — expect failure**

```bash
npm test tests/lib/voice/analyzer.test.ts
```

**Step 3: Implement `src/lib/voice/analyzer.ts`**

```typescript
// src/lib/voice/analyzer.ts
import { callClaude } from '@/lib/ai/client';
import type { VoiceProfile } from '@/db/schema';

export function buildVoiceAnalysisPrompt(samples: string[]): string {
  const joined = samples.map((s, i) => `--- Sample ${i + 1} ---\n${s}`).join('\n\n');
  return `Analyze the writing samples below and extract a voice profile as JSON.

Return ONLY valid JSON matching this shape:
{
  "toneDescriptors": ["direct", "analytical", ...],
  "sentencePatterns": "Tends toward medium-length sentences...",
  "recurringThemes": ["AI", "startups", ...],
  "opinionStances": ["Contrarian about remote work", ...],
  "topicsToAvoid": ["celebrity news", ...],
  "vocabularyNotes": "Uses technical terms without over-explaining...",
  "idealReader": "A technical founder or senior IC at a startup"
}

WRITING SAMPLES:
${joined}`;
}

export async function analyzeVoice(
  samples: string[],
  channelId: string,
  voiceProfileId: string
): Promise<VoiceProfile> {
  const prompt = buildVoiceAnalysisPrompt(samples);
  const raw = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    system: 'You are a writing style analyst. Return only valid JSON, no explanation.',
    prompt,
    maxTokens: 1024,
    audit: {
      operation: 'voice_analysis',
      channelId,
      entityType: 'voice_profile',
      entityId: voiceProfileId,
    },
  });

  return JSON.parse(raw) as VoiceProfile;
}
```

**Step 4: Implement `src/lib/voice/assembler.ts`**

```typescript
// src/lib/voice/assembler.ts
import { db } from '@/db/client';
import { voiceProfiles, channels } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function assemblePersonaPrompt(channelId: string): Promise<string> {
  const profiles = await db.select()
    .from(voiceProfiles)
    .where(eq(voiceProfiles.channelId, channelId));

  if (profiles.length === 0) return '';

  const parts: string[] = [];
  for (const p of profiles) {
    if (p.extractedProfile) {
      const vp = p.extractedProfile;
      parts.push(`TONE: ${vp.toneDescriptors.join(', ')}`);
      parts.push(`SENTENCE STYLE: ${vp.sentencePatterns}`);
      parts.push(`RECURRING THEMES: ${vp.recurringThemes.join(', ')}`);
      parts.push(`OPINION STANCES: ${vp.opinionStances.join('; ')}`);
      parts.push(`TOPICS TO AVOID: ${vp.topicsToAvoid.join(', ')}`);
      parts.push(`VOCABULARY NOTES: ${vp.vocabularyNotes}`);
      parts.push(`IDEAL READER: ${vp.idealReader}`);
    }
  }

  const prompt = `You are writing as a specific person with the following voice profile:\n\n${parts.join('\n')}\n\nWrite authentically in this voice. Never break character.`;

  // Persist assembled persona_prompt to channel
  await db.update(channels)
    .set({ personaPrompt: prompt, updatedAt: new Date() })
    .where(eq(channels.id, channelId));

  return prompt;
}
```

**Step 5: Create `src/app/api/voice/route.ts`**

```typescript
// src/app/api/voice/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { voiceProfiles } from '@/db/schema';
import { analyzeVoice } from '@/lib/voice/analyzer';
import { assemblePersonaPrompt } from '@/lib/voice/assembler';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { channelId, method, samples, wizardAnswers } = body;

  const profileId = randomUUID();

  if (method === 'archive' || method === 'samples') {
    // samples is string[]
    const extracted = await analyzeVoice(samples, channelId, profileId);
    const [profile] = await db.insert(voiceProfiles).values({
      id: profileId,
      channelId,
      method,
      rawInput: samples.join('\n\n---\n\n'),
      extractedProfile: extracted,
    }).returning();

    await assemblePersonaPrompt(channelId);
    return NextResponse.json(profile, { status: 201 });
  }

  if (method === 'wizard') {
    // wizardAnswers is { question: string, answer: string }[]
    const rawInput = wizardAnswers.map((qa: any) => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n');
    const [profile] = await db.insert(voiceProfiles).values({
      id: profileId,
      channelId,
      method: 'wizard',
      rawInput,
      extractedProfile: null, // Wizard doesn't run AI analysis — answers assemble directly
    }).returning();

    await assemblePersonaPrompt(channelId);
    return NextResponse.json(profile, { status: 201 });
  }

  return NextResponse.json({ error: 'Invalid method' }, { status: 400 });
}
```

**Step 6: Run tests**

```bash
npm test tests/lib/voice/
```

**Step 7: Commit**

```bash
git add src/lib/voice/ src/app/api/voice/ tests/lib/voice/
git commit -m "feat: add voice profile analysis and persona assembly"
```

---

### Task 2.3: Channel UI — list, create, and dashboard

**Files:**
- Create: `src/app/(app)/channels/page.tsx`
- Create: `src/app/(app)/channels/new/page.tsx`
- Create: `src/components/channels/ChannelCard.tsx`
- Create: `src/components/channels/CreateChannelForm.tsx`
- Create: `src/components/channels/ResearchConfigForm.tsx`
- Create: `src/components/channels/ScheduleConfigForm.tsx`
- Create: `src/components/channels/VoiceWizard.tsx`

**Step 1: Install shadcn/ui**

```bash
npx shadcn@latest init
# Choose: Default style, Zinc color, CSS variables: yes
npx shadcn@latest add button card form input label select textarea badge tabs dialog
```

**Step 2: Create root layout with nav**

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SideNav } from '@/components/layout/SideNav';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = { title: 'Destink', description: 'Content automation' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex h-screen">
          <SideNav />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
```

**Step 3: Create `src/components/layout/SideNav.tsx`**

```typescript
// src/components/layout/SideNav.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const links = [
  { href: '/channels', label: 'Channels' },
  { href: '/drafts', label: 'Drafts' },
  { href: '/queue', label: 'Queue' },
  { href: '/audit', label: 'AI Usage' },
];

export function SideNav() {
  const path = usePathname();
  return (
    <nav className="w-48 border-r bg-muted/40 p-4 flex flex-col gap-1">
      <div className="font-bold text-lg mb-4">Destink</div>
      {links.map(l => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            'px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors',
            path.startsWith(l.href) ? 'bg-muted font-medium' : ''
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
```

**Step 4: Implement Channel list and create form pages**

Reference the design doc for UI layout. Implement channel list as server component fetching from API, create form as client component posting to `POST /api/channels`.

The Voice Wizard component is a multi-step form (shadcn Dialog) with these steps:
1. Writing style (3 words)
2. Contrarian belief
3. Topics to avoid
4. Writers you admire
5. Ideal reader

**Step 5: Start dev server and verify rendering**

```bash
npm run dev:all
# Open http://localhost:3021/channels
```

Expected: Channels page renders with empty state and "New Channel" button.

**Step 6: Commit**

```bash
git add src/app/ src/components/
git commit -m "feat: add channel list, create form, and voice wizard UI"
```

---

## Phase 3: Research Engine

### Task 3.1: Exa web search adapter

**Files:**
- Create: `src/lib/research/exa.ts`
- Create: `tests/lib/research/exa.test.ts`

**Step 1: Write failing test**

```typescript
// tests/lib/research/exa.test.ts
import { describe, it, expect } from 'vitest';
import { buildExaQueries } from '@/lib/research/exa';
import type { ResearchConfig } from '@/db/schema';

describe('buildExaQueries', () => {
  it('generates queries from topics and templates', () => {
    const config: Partial<ResearchConfig> = {
      topics: ['AI agents'],
      searchQueryTemplates: ['latest news about {topic}'],
    };
    const queries = buildExaQueries(config as ResearchConfig);
    expect(queries).toContain('latest news about AI agents');
  });
});
```

**Step 2: Implement `src/lib/research/exa.ts`**

```typescript
// src/lib/research/exa.ts
import type { ResearchConfig, ResearchSource } from '@/db/schema';

// Install: npm install exa-js
// Docs: https://docs.exa.ai
import Exa from 'exa-js';

export function buildExaQueries(config: ResearchConfig): string[] {
  const queries: string[] = [];
  for (const topic of config.topics) {
    for (const template of config.searchQueryTemplates) {
      queries.push(template.replace('{topic}', topic));
    }
    // Default query if no templates
    if (config.searchQueryTemplates.length === 0) {
      queries.push(`${topic} recent developments`);
    }
  }
  return [...new Set(queries)]; // deduplicate
}

export async function searchExa(config: ResearchConfig): Promise<ResearchSource[]> {
  const client = new Exa(process.env.EXA_API_KEY!);
  const queries = buildExaQueries(config);
  const sources: ResearchSource[] = [];

  for (const query of queries.slice(0, 5)) { // cap at 5 queries per run
    const result = await client.searchAndContents(query, {
      numResults: 3,
      highlights: true,
      excludeDomains: config.excludedDomains,
    });
    for (const r of result.results) {
      sources.push({
        url: r.url,
        title: r.title ?? '',
        summary: r.highlights?.join(' ') ?? r.text?.slice(0, 500) ?? '',
        source: 'exa',
      });
    }
  }

  return sources;
}
```

**Step 3: Run test**

```bash
npm test tests/lib/research/exa.test.ts
```

Expected: PASS (unit test for `buildExaQueries` — doesn't call API)

**Step 4: Commit**

```bash
git add src/lib/research/exa.ts tests/lib/research/exa.test.ts
git commit -m "feat: add Exa web search research adapter"
```

---

### Task 3.2: Reddit API adapter

**Files:**
- Create: `src/lib/research/reddit.ts`
- Create: `tests/lib/research/reddit.test.ts`

**Step 1: Write failing test**

```typescript
// tests/lib/research/reddit.test.ts
import { describe, it, expect } from 'vitest';
import { buildRedditUrl } from '@/lib/research/reddit';

describe('buildRedditUrl', () => {
  it('builds correct hot posts URL for subreddit', () => {
    const url = buildRedditUrl('artificial', 'hot', 10);
    expect(url).toBe('https://www.reddit.com/r/artificial/hot.json?limit=10');
  });
});
```

**Step 2: Implement `src/lib/research/reddit.ts`**

```typescript
// src/lib/research/reddit.ts
import type { ResearchConfig, ResearchSource } from '@/db/schema';

export function buildRedditUrl(subreddit: string, sort: 'hot' | 'top', limit: number): string {
  return `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}`;
}

export async function searchReddit(config: ResearchConfig): Promise<ResearchSource[]> {
  const sources: ResearchSource[] = [];

  for (const subreddit of config.subreddits.slice(0, 5)) {
    const url = buildRedditUrl(subreddit, 'hot', 5);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Destink/1.0 (personal content tool)' },
    });

    if (!res.ok) continue;

    const json = await res.json();
    const posts = json?.data?.children ?? [];

    for (const post of posts) {
      const { title, url: postUrl, selftext, score } = post.data;
      if (score < 50) continue; // skip low-engagement posts
      sources.push({
        url: postUrl,
        title,
        summary: selftext?.slice(0, 400) ?? title,
        source: 'reddit',
      });
    }
  }

  return sources;
}
```

**Step 3: Run test**

```bash
npm test tests/lib/research/reddit.test.ts
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/research/reddit.ts tests/lib/research/reddit.test.ts
git commit -m "feat: add Reddit API research adapter"
```

---

### Task 3.3: Substack feed monitor

**Files:**
- Create: `src/lib/research/substack-monitor.ts`
- Create: `tests/lib/research/substack-monitor.test.ts`

**Step 1: Write failing test**

```typescript
// tests/lib/research/substack-monitor.test.ts
import { describe, it, expect } from 'vitest';
import { buildSubstackRssUrl } from '@/lib/research/substack-monitor';

describe('buildSubstackRssUrl', () => {
  it('builds correct feed URL from slug', () => {
    const url = buildSubstackRssUrl('example.substack.com');
    expect(url).toBe('https://example.substack.com/feed');
  });
});
```

**Step 2: Implement `src/lib/research/substack-monitor.ts`**

```typescript
// src/lib/research/substack-monitor.ts
import type { ResearchConfig, ResearchSource } from '@/db/schema';

// Install: npm install rss-parser
import Parser from 'rss-parser';

const parser = new Parser();

export function buildSubstackRssUrl(publicationUrl: string): string {
  const base = publicationUrl.startsWith('http') ? publicationUrl : `https://${publicationUrl}`;
  return `${base}/feed`;
}

export async function monitorSubstackFeeds(config: ResearchConfig): Promise<ResearchSource[]> {
  const sources: ResearchSource[] = [];

  for (const feed of config.substackFeeds.slice(0, 5)) {
    try {
      const url = buildSubstackRssUrl(feed);
      const parsed = await parser.parseURL(url);

      for (const item of (parsed.items ?? []).slice(0, 3)) {
        sources.push({
          url: item.link ?? '',
          title: item.title ?? '',
          summary: item.contentSnippet?.slice(0, 400) ?? '',
          source: 'substack',
        });
      }
    } catch {
      // skip failed feeds silently
    }
  }

  return sources;
}
```

Install dependency:
```bash
npm install rss-parser @types/rss-parser
```

**Step 3: Run test**

```bash
npm test tests/lib/research/substack-monitor.test.ts
```

**Step 4: Commit**

```bash
git add src/lib/research/substack-monitor.ts tests/lib/research/substack-monitor.test.ts
git commit -m "feat: add Substack RSS feed monitor"
```

---

### Task 3.4: AI brainstorm + research engine orchestrator

**Files:**
- Create: `src/lib/research/brainstorm.ts`
- Create: `src/lib/research/engine.ts`
- Create: `tests/lib/research/engine.test.ts`

**Step 1: Implement `src/lib/research/brainstorm.ts`**

```typescript
// src/lib/research/brainstorm.ts
import { callClaude } from '@/lib/ai/client';
import type { ResearchConfig, ResearchSource, VoiceProfile } from '@/db/schema';

export async function brainstormTopics(
  config: ResearchConfig,
  voiceProfile: VoiceProfile | null,
  recentTitles: string[],
  channelId: string
): Promise<ResearchSource[]> {
  const recentContext = recentTitles.length > 0
    ? `\n\nRecent posts (avoid repeating):\n${recentTitles.map(t => `- ${t}`).join('\n')}`
    : '';

  const personaContext = voiceProfile
    ? `\n\nWriter persona: ${voiceProfile.toneDescriptors.join(', ')}. Interested in: ${voiceProfile.recurringThemes.join(', ')}.`
    : '';

  const prompt = `Generate 8 interesting topic ideas for a content creator in these areas: ${config.topics.join(', ')}.

Keywords of interest: ${config.keywords.join(', ')}${personaContext}${recentContext}

Return as JSON array:
[{"title": "...", "angle": "...", "whyTimely": "..."}]

Return ONLY the JSON array, no explanation.`;

  const raw = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    system: 'You are a content strategist. Return only valid JSON.',
    prompt,
    maxTokens: 1024,
    audit: { operation: 'brainstorm', channelId },
  });

  const ideas = JSON.parse(raw) as { title: string; angle: string; whyTimely: string }[];
  return ideas.map(idea => ({
    url: '',
    title: idea.title,
    summary: `${idea.angle}\n\nWhy timely: ${idea.whyTimely}`,
    source: 'brainstorm' as const,
  }));
}
```

**Step 2: Write failing test for engine orchestrator**

```typescript
// tests/lib/research/engine.test.ts
import { describe, it, expect, vi } from 'vitest';
import { buildAnalysisPrompt } from '@/lib/research/engine';
import type { ResearchSource } from '@/db/schema';

describe('buildAnalysisPrompt', () => {
  it('includes all sources in the prompt', () => {
    const sources: ResearchSource[] = [
      { url: 'https://a.com', title: 'Test Article', summary: 'Summary here', source: 'exa' },
    ];
    const prompt = buildAnalysisPrompt(sources, 'A developer persona', []);
    expect(prompt).toContain('Test Article');
    expect(prompt).toContain('relevanceScore');
  });
});
```

**Step 3: Implement `src/lib/research/engine.ts`**

```typescript
// src/lib/research/engine.ts
import { db } from '@/db/client';
import { channels, researchRuns, voiceProfiles, drafts } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { searchExa } from './exa';
import { searchReddit } from './reddit';
import { monitorSubstackFeeds } from './substack-monitor';
import { brainstormTopics } from './brainstorm';
import { callClaude } from '@/lib/ai/client';
import type { ResearchSource, TopicRecommendation, ResearchConfig, VoiceProfile } from '@/db/schema';

export function buildAnalysisPrompt(
  sources: ResearchSource[],
  personaPrompt: string,
  recentTitles: string[]
): string {
  const sourcesText = sources
    .map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\nSummary: ${s.summary}`)
    .join('\n\n');

  return `You are analyzing research for a content creator. Given their persona and these sources, rank the best content opportunities.

PERSONA:
${personaPrompt}

RECENT POSTS (avoid repeating themes):
${recentTitles.map(t => `- ${t}`).join('\n') || 'None'}

SOURCES:
${sourcesText}

Return a JSON array of up to 10 topic recommendations:
[{
  "title": "Suggested post title",
  "angle": "Specific angle this writer should take",
  "whyTimely": "Why this matters right now",
  "relevanceScore": 85,
  "contentType": "note",
  "sources": [{ "url": "...", "title": "...", "summary": "...", "source": "exa" }]
}]

Sort by relevanceScore descending. Return ONLY the JSON array.`;
}

export async function runResearchForChannel(channelId: string): Promise<void> {
  const [channel] = await db.select().from(channels).where(eq(channels.id, channelId));
  if (!channel || !channel.researchConfig) throw new Error(`Channel ${channelId} not found or missing research config`);

  const config = channel.researchConfig as ResearchConfig;

  // Fetch recent published post titles for deduplication
  const recentDrafts = await db.select({ title: drafts.title })
    .from(drafts)
    .where(eq(drafts.channelId, channelId))
    .orderBy(desc(drafts.createdAt))
    .limit(10);
  const recentTitles = recentDrafts.map(d => d.title ?? '').filter(Boolean);

  // Get voice profile
  const [profile] = await db.select().from(voiceProfiles).where(eq(voiceProfiles.channelId, channelId));
  const voiceProfile = profile?.extractedProfile as VoiceProfile | null;

  // Gather signals in parallel
  const [exaSources, redditSources, substackSources, brainstormSources] = await Promise.all([
    searchExa(config),
    searchReddit(config),
    monitorSubstackFeeds(config),
    brainstormTopics(config, voiceProfile, recentTitles, channelId),
  ]);

  const allSources = [...exaSources, ...redditSources, ...substackSources, ...brainstormSources];

  // AI analysis and ranking
  const analysisPrompt = buildAnalysisPrompt(allSources, channel.personaPrompt ?? '', recentTitles);
  const raw = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    system: 'You are a content strategist. Return only valid JSON.',
    prompt: analysisPrompt,
    maxTokens: 2048,
    audit: { operation: 'topic_ranking', channelId },
  });

  const topics: TopicRecommendation[] = JSON.parse(raw);

  // Store research run
  const [run] = await db.insert(researchRuns).values({
    channelId,
    sourcesSearched: { exa: exaSources.length, reddit: redditSources.length, substack: substackSources.length, brainstorm: brainstormSources.length },
    topicsFound: topics,
    aiModel: 'claude-haiku-4-5-20251001',
    tokensUsed: 0, // updated by audit log
  }).returning();

  console.log(`[research] Channel ${channelId}: found ${topics.length} topics, run ${run.id}`);
}
```

**Step 4: Run test**

```bash
npm test tests/lib/research/engine.test.ts
```

**Step 5: Create research API route for manual trigger**

```typescript
// src/app/api/research/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { runResearchForChannel } from '@/lib/research/engine';

export async function POST(req: NextRequest) {
  const { channelId } = await req.json();
  // Fire and forget — don't wait for completion
  runResearchForChannel(channelId).catch(console.error);
  return NextResponse.json({ status: 'started' });
}
```

**Step 6: Commit**

```bash
git add src/lib/research/ src/app/api/research/ tests/lib/research/
git commit -m "feat: add research engine with 4 signal sources and AI ranking"
```

---

## Phase 4: Content Generation

### Task 4.1: Context builder and draft generator

**Files:**
- Create: `src/lib/generation/context-builder.ts`
- Create: `src/lib/generation/generator.ts`
- Create: `src/app/api/drafts/route.ts`
- Create: `tests/lib/generation/generator.test.ts`

**Step 1: Write failing test**

```typescript
// tests/lib/generation/generator.test.ts
import { describe, it, expect } from 'vitest';
import { buildGenerationPrompt } from '@/lib/generation/generator';

describe('buildGenerationPrompt', () => {
  it('includes content type spec for notes', () => {
    const prompt = buildGenerationPrompt({
      contentType: 'note',
      personaPrompt: 'Direct, analytical voice.',
      topicTitle: 'AI and remote work',
      topicAngle: 'Contrarian take',
      sources: [],
      recentTitles: [],
    });
    expect(prompt).toContain('150–300 words');
    expect(prompt).toContain('AI and remote work');
  });

  it('includes content type spec for articles', () => {
    const prompt = buildGenerationPrompt({
      contentType: 'article',
      personaPrompt: 'Direct, analytical voice.',
      topicTitle: 'AI and remote work',
      topicAngle: 'Contrarian take',
      sources: [],
      recentTitles: [],
    });
    expect(prompt).toContain('800–2000 words');
  });
});
```

**Step 2: Implement `src/lib/generation/generator.ts`**

```typescript
// src/lib/generation/generator.ts
import { callClaude } from '@/lib/ai/client';
import type { ResearchSource } from '@/db/schema';

export interface GenerationInput {
  contentType: 'note' | 'article';
  personaPrompt: string;
  topicTitle: string;
  topicAngle: string;
  sources: ResearchSource[];
  recentTitles: string[];
  regenerationNote?: string;
}

export interface GeneratedDraft {
  headlineOptions: string[];
  hook: string;
  body: string;
  cta: string;
  voiceConfidence: number;
}

export function buildGenerationPrompt(input: GenerationInput): string {
  const { contentType, personaPrompt, topicTitle, topicAngle, sources, recentTitles, regenerationNote } = input;

  const sourceContext = sources.length > 0
    ? `\n\nSOURCE MATERIAL (use for facts and context, do not copy):\n${sources.map(s => `- ${s.title}: ${s.summary}`).join('\n')}`
    : '';

  const recentContext = recentTitles.length > 0
    ? `\n\nRECENT POSTS (do not repeat these themes):\n${recentTitles.map(t => `- ${t}`).join('\n')}`
    : '';

  const regenContext = regenerationNote
    ? `\n\nREVISION REQUEST: ${regenerationNote}`
    : '';

  const spec = contentType === 'note'
    ? '150–300 words, punchy and direct, optimized for social scroll-stopping'
    : '800–2000 words, structured argument with clear thesis, supporting points, and conclusion';

  return `${personaPrompt}

TASK: Write a ${contentType} about "${topicTitle}".
ANGLE: ${topicAngle}
LENGTH/FORMAT: ${spec}${sourceContext}${recentContext}${regenContext}

Return ONLY valid JSON:
{
  "headlineOptions": ["Option A", "Option B", "Option C"],
  "hook": "First 1-2 sentences that stop the scroll",
  "body": "Full content here",
  "cta": "Call to action appropriate for the platform",
  "voiceConfidence": 85
}

voiceConfidence is your self-assessment (0-100) of how well this matches the persona. Flag anything below 60.`;
}

export async function generateDraft(
  input: GenerationInput,
  channelId: string,
  draftId: string
): Promise<GeneratedDraft> {
  const prompt = buildGenerationPrompt(input);
  const raw = await callClaude({
    model: 'claude-sonnet-4-6',
    system: 'You are a ghostwriter. Return only valid JSON, no preamble.',
    prompt,
    maxTokens: 4096,
    audit: {
      operation: 'draft_generation',
      channelId,
      entityType: 'draft',
      entityId: draftId,
    },
  });

  return JSON.parse(raw) as GeneratedDraft;
}
```

**Step 3: Run test**

```bash
npm test tests/lib/generation/generator.test.ts
```

Expected: PASS

**Step 4: Implement draft API routes**

```typescript
// src/app/api/drafts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { drafts, channels, voiceProfiles } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { generateDraft } from '@/lib/generation/generator';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get('channelId');
  const status = searchParams.get('status') ?? 'pending_review';

  const query = db.select().from(drafts)
    .where(eq(drafts.status, status as any))
    .orderBy(desc(drafts.createdAt));

  const rows = await query;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { channelId, contentType, topicTitle, topicAngle, sources, regenerationNote } = body;

  const [channel] = await db.select().from(channels).where(eq(channels.id, channelId));
  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });

  const recentDrafts = await db.select({ title: drafts.title })
    .from(drafts)
    .where(eq(drafts.channelId, channelId))
    .orderBy(desc(drafts.createdAt))
    .limit(10);

  const draftId = randomUUID();
  const generated = await generateDraft(
    {
      contentType,
      personaPrompt: channel.personaPrompt ?? '',
      topicTitle,
      topicAngle,
      sources: sources ?? [],
      recentTitles: recentDrafts.map(d => d.title ?? '').filter(Boolean),
      regenerationNote,
    },
    channelId,
    draftId
  );

  const [draft] = await db.insert(drafts).values({
    id: draftId,
    channelId,
    contentType,
    title: generated.headlineOptions[0],
    headlineOptions: generated.headlineOptions,
    hook: generated.hook,
    body: generated.body,
    cta: generated.cta,
    voiceConfidence: generated.voiceConfidence,
    researchSources: sources ?? [],
    aiModel: 'claude-sonnet-4-6',
    status: 'pending_review',
    regenerationNote,
  }).returning();

  return NextResponse.json(draft, { status: 201 });
}
```

**Step 5: Add approve, reject, regenerate sub-routes**

```typescript
// src/app/api/drafts/[id]/approve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { drafts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { assignScheduledTime } from '@/lib/publishing/scheduler';
import { publishQueue, channels } from '@/db/schema';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const [draft] = await db.update(drafts)
    .set({ status: 'approved', updatedAt: new Date() })
    .where(eq(drafts.id, params.id))
    .returning();

  if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [channel] = await db.select().from(channels).where(eq(channels.id, draft.channelId));
  const scheduledFor = assignScheduledTime(channel.platform, channel.scheduleConfig as any);

  const [queueItem] = await db.insert(publishQueue).values({
    draftId: draft.id,
    channelId: draft.channelId,
    scheduledFor,
    status: 'queued',
  }).returning();

  return NextResponse.json({ draft, queueItem });
}
```

```typescript
// src/app/api/drafts/[id]/reject/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { drafts } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { reason } = await req.json();
  const [draft] = await db.update(drafts)
    .set({ status: 'rejected', rejectionReason: reason, updatedAt: new Date() })
    .where(eq(drafts.id, params.id))
    .returning();
  return NextResponse.json(draft);
}
```

**Step 6: Commit**

```bash
git add src/lib/generation/ src/app/api/drafts/ tests/lib/generation/
git commit -m "feat: add content generation pipeline with approve/reject/regenerate API"
```

---

## Phase 5: Review Queue UI

### Task 5.1: Draft review page

**Files:**
- Create: `src/app/(app)/drafts/page.tsx`
- Create: `src/components/drafts/DraftCard.tsx`
- Create: `src/components/drafts/DraftDetailPanel.tsx`
- Create: `src/components/drafts/DraftActions.tsx`

**Step 1: Implement `src/app/(app)/drafts/page.tsx`**

Server component that fetches pending drafts and renders them as cards. Clicking a card opens a side panel with full content, actions, and source links.

Key behaviors:
- Filter bar at top: by channel, content type, voice confidence threshold
- Cards sorted by date (newest first)
- Cards with voice confidence < 60 show a yellow warning badge
- Side panel shows all headline options (selectable), hook, full body, CTA, and source links
- Action buttons: Approve, Reject, Edit (inline editor), Regenerate (with note field)

**Step 2: Install rich text editor for body editing**

```bash
npx shadcn@latest add textarea
# Use plain textarea for now — upgrade to Tiptap in v2
```

**Step 3: Wire up client-side actions**

Create `src/components/drafts/DraftActions.tsx` as a client component that:
- Calls `POST /api/drafts/{id}/approve` on Approve
- Calls `POST /api/drafts/{id}/reject` with reason on Reject
- Calls `POST /api/drafts` with `regenerationNote` on Regenerate
- Uses `router.refresh()` after each action to re-fetch the list

**Step 4: Start dev server and manually verify**

```bash
npm run dev
# Navigate to http://localhost:3021/drafts
# Verify: empty state when no drafts, card layout when drafts exist
```

**Step 5: Commit**

```bash
git add src/app/(app)/drafts/ src/components/drafts/
git commit -m "feat: add draft review page with approve/reject/regenerate UI"
```

---

### Task 5.2: Publish queue timeline

**Files:**
- Create: `src/app/(app)/queue/page.tsx`
- Create: `src/components/queue/QueueTimeline.tsx`
- Create: `src/components/queue/QueueItem.tsx`
- Create: `src/app/api/queue/route.ts`

**Step 1: Implement queue API**

```typescript
// src/app/api/queue/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { publishQueue, drafts, channels } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';

export async function GET() {
  const items = await db.select({
    queue: publishQueue,
    draft: { title: drafts.title, contentType: drafts.contentType, body: drafts.body },
    channel: { name: channels.name, platform: channels.platform },
  })
  .from(publishQueue)
  .innerJoin(drafts, eq(publishQueue.draftId, drafts.id))
  .innerJoin(channels, eq(publishQueue.channelId, channels.id))
  .orderBy(asc(publishQueue.scheduledFor));

  return NextResponse.json(items);
}
```

**Step 2: Implement `src/app/api/queue/[id]/route.ts`** for PATCH (reschedule) and publish-now.

**Step 3: Implement QueueTimeline as a client component**

- Shows items grouped by date
- Each item: channel badge, content type, title, scheduled time, status badge
- "Publish Now" button calls `POST /api/queue/{id}/publish-now`
- Drag-to-reorder using `@dnd-kit/core`

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Step 4: Commit**

```bash
git add src/app/(app)/queue/ src/components/queue/ src/app/api/queue/
git commit -m "feat: add publish queue timeline with drag-to-reorder"
```

---

## Phase 6: Scheduling

### Task 6.1: Scheduling logic

**Files:**
- Create: `src/lib/publishing/scheduler.ts`
- Create: `tests/lib/publishing/scheduler.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/lib/publishing/scheduler.test.ts
import { describe, it, expect } from 'vitest';
import { assignScheduledTime, applyJitter } from '@/lib/publishing/scheduler';
import type { ScheduleConfig } from '@/db/schema';

const linkedinConfig: ScheduleConfig = {
  timezone: 'America/New_York',
  minGapHours: 18,
  jitterMinutes: 30,
  timeWindows: [{ dayOfWeek: [2, 3, 4], startHour: 8, endHour: 10 }],
};

describe('applyJitter', () => {
  it('adds random offset within jitter range', () => {
    const base = new Date('2026-03-10T08:00:00Z');
    const jittered = applyJitter(base, 30);
    const diffMin = (jittered.getTime() - base.getTime()) / 60000;
    expect(diffMin).toBeGreaterThanOrEqual(-30);
    expect(diffMin).toBeLessThanOrEqual(30);
  });
});

describe('assignScheduledTime', () => {
  it('returns a date in the future', () => {
    const scheduled = assignScheduledTime('linkedin', linkedinConfig);
    expect(scheduled.getTime()).toBeGreaterThan(Date.now());
  });
});
```

**Step 2: Implement `src/lib/publishing/scheduler.ts`**

```typescript
// src/lib/publishing/scheduler.ts
import type { ScheduleConfig } from '@/db/schema';

// Default configs used if channel scheduleConfig is null
const DEFAULT_WINDOWS: Record<string, ScheduleConfig> = {
  linkedin: {
    timezone: 'America/New_York',
    minGapHours: 18,
    jitterMinutes: 30,
    timeWindows: [
      { dayOfWeek: [2, 3, 4], startHour: 8, endHour: 10 },
      { dayOfWeek: [2, 3, 4], startHour: 12, endHour: 13 },
    ],
  },
  substack: {
    timezone: 'America/New_York',
    minGapHours: 24,
    jitterMinutes: 20,
    timeWindows: [
      { dayOfWeek: [2, 4], startHour: 7, endHour: 9 },
    ],
  },
};

export function applyJitter(base: Date, jitterMinutes: number): Date {
  const offsetMs = (Math.random() * 2 - 1) * jitterMinutes * 60 * 1000;
  return new Date(base.getTime() + offsetMs);
}

export function assignScheduledTime(
  platform: string,
  config: ScheduleConfig | null
): Date {
  const cfg = config ?? DEFAULT_WINDOWS[platform] ?? DEFAULT_WINDOWS.linkedin;
  const now = new Date();

  // Find next valid window
  for (let daysAhead = 0; daysAhead < 14; daysAhead++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + daysAhead);
    const dow = candidate.getDay();

    for (const window of cfg.timeWindows) {
      if (!window.dayOfWeek.includes(dow)) continue;

      // Pick midpoint of window
      const midHour = (window.startHour + window.endHour) / 2;
      candidate.setHours(Math.floor(midHour), 0, 0, 0);

      // Must be in the future
      if (candidate.getTime() <= now.getTime()) continue;

      return applyJitter(candidate, cfg.jitterMinutes);
    }
  }

  // Fallback: 24 hours from now
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}
```

**Step 3: Run tests**

```bash
npm test tests/lib/publishing/scheduler.test.ts
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/publishing/scheduler.ts tests/lib/publishing/scheduler.test.ts
git commit -m "feat: add smart scheduling with time windows and jitter"
```

---

### Task 6.2: Daemon — publish loop

**Files:**
- Create: `src/daemon/index.ts`
- Create: `tests/daemon/daemon.test.ts`

**Step 1: Write failing test for retry logic**

```typescript
// tests/daemon/daemon.test.ts
import { describe, it, expect } from 'vitest';
import { getRetryDelay } from '@/daemon/index';

describe('getRetryDelay', () => {
  it('returns 5min for first retry', () => {
    expect(getRetryDelay(1)).toBe(5 * 60 * 1000);
  });
  it('returns 15min for second retry', () => {
    expect(getRetryDelay(2)).toBe(15 * 60 * 1000);
  });
  it('returns 45min for third retry', () => {
    expect(getRetryDelay(3)).toBe(45 * 60 * 1000);
  });
});
```

**Step 2: Implement `src/daemon/index.ts`**

```typescript
// src/daemon/index.ts
import cron from 'node-cron';
import { db } from '@/db/client';
import { publishQueue, drafts, channels } from '@/db/schema';
import { eq, lte, and } from 'drizzle-orm';
import { publishToSubstack } from '@/lib/publishing/substack';
import { publishToLinkedIn } from '@/lib/publishing/linkedin';

export function getRetryDelay(retryCount: number): number {
  const delays = [5, 15, 45];
  return (delays[retryCount - 1] ?? 45) * 60 * 1000;
}

async function processPublishQueue() {
  const now = new Date();
  const items = await db.select({
    queue: publishQueue,
    draft: drafts,
    channel: channels,
  })
  .from(publishQueue)
  .innerJoin(drafts, eq(publishQueue.draftId, drafts.id))
  .innerJoin(channels, eq(publishQueue.channelId, channels.id))
  .where(
    and(
      lte(publishQueue.scheduledFor, now),
      eq(publishQueue.status, 'queued')
    )
  );

  for (const item of items) {
    await db.update(publishQueue)
      .set({ status: 'publishing' })
      .where(eq(publishQueue.id, item.queue.id));

    try {
      let platformResponse: unknown;

      if (item.channel.platform === 'substack') {
        platformResponse = await publishToSubstack(item.draft, item.channel);
      } else if (item.channel.platform === 'linkedin') {
        platformResponse = await publishToLinkedIn(item.draft, item.channel);
      }

      await db.update(publishQueue)
        .set({ status: 'published', publishedAt: new Date(), platformResponse })
        .where(eq(publishQueue.id, item.queue.id));

      await db.update(drafts)
        .set({ status: 'published' })
        .where(eq(drafts.id, item.draft.id));

      console.log(`[daemon] Published ${item.draft.title} to ${item.channel.platform}`);

    } catch (err) {
      const retryCount = (item.queue.retryCount ?? 0) + 1;
      const maxRetries = 3;

      if (retryCount >= maxRetries) {
        await db.update(publishQueue)
          .set({ status: 'failed', retryCount, errorMessage: String(err) })
          .where(eq(publishQueue.id, item.queue.id));
        console.error(`[daemon] Permanently failed: ${item.draft.title}`, err);
      } else {
        const delay = getRetryDelay(retryCount);
        const nextAttempt = new Date(Date.now() + delay);
        await db.update(publishQueue)
          .set({ status: 'queued', retryCount, scheduledFor: nextAttempt, errorMessage: String(err) })
          .where(eq(publishQueue.id, item.queue.id));
        console.warn(`[daemon] Will retry ${item.draft.title} at ${nextAttempt.toISOString()}`);
      }
    }
  }
}

// Run publish check every minute
cron.schedule('* * * * *', () => {
  processPublishQueue().catch(console.error);
});

console.log('[daemon] Publish loop started — checking queue every minute');
```

**Step 3: Run test**

```bash
npm test tests/daemon/daemon.test.ts
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/daemon/ tests/daemon/
git commit -m "feat: add daemon publish loop with exponential backoff retry"
```

---

## Phase 7: Publishing Integrations

### Task 7.1: Substack publisher

**Files:**
- Create: `src/lib/publishing/substack.ts`
- Create: `tests/lib/publishing/substack.test.ts`

**Step 1: Install substack-api**

```bash
npm install substack-api
```

Check the package docs at: https://github.com/jakub-k-slys/substack-api — verify the exact API for posting notes and articles before implementing.

**Step 2: Write failing test**

```typescript
// tests/lib/publishing/substack.test.ts
import { describe, it, expect } from 'vitest';
import { formatForSubstack } from '@/lib/publishing/substack';

describe('formatForSubstack', () => {
  it('formats a note as plain text', () => {
    const result = formatForSubstack('note', 'Test body content');
    expect(result.body).toBe('Test body content');
    expect(result.type).toBe('note');
  });

  it('formats an article with markdown', () => {
    const result = formatForSubstack('article', '# Heading\n\nBody here');
    expect(result.type).toBe('post');
    expect(result.body).toContain('Heading');
  });
});
```

**Step 3: Implement `src/lib/publishing/substack.ts`**

```typescript
// src/lib/publishing/substack.ts
import { decrypt } from '@/lib/crypto';
import type { InferSelectModel } from 'drizzle-orm';
import type { drafts, channels } from '@/db/schema';

type Draft = InferSelectModel<typeof drafts>;
type Channel = InferSelectModel<typeof channels>;

export function formatForSubstack(
  contentType: 'note' | 'article',
  body: string
): { type: 'note' | 'post'; body: string } {
  return {
    type: contentType === 'note' ? 'note' : 'post',
    body,
  };
}

export async function publishToSubstack(draft: Draft, channel: Channel): Promise<unknown> {
  if (!channel.credentials) throw new Error('No Substack credentials configured for this channel');

  const encKey = process.env.ENCRYPTION_KEY!;
  const credsJson = decrypt(channel.credentials, encKey);
  if (!credsJson) throw new Error('Failed to decrypt Substack credentials');

  const creds = JSON.parse(credsJson) as { cookies: string };

  // Dynamic import to avoid issues at build time
  const { SubstackClient } = await import('substack-api');
  // NOTE: Verify exact API shape from substack-api package docs
  const client = new SubstackClient({ cookies: creds.cookies });

  const formatted = formatForSubstack(draft.contentType, draft.body ?? '');
  const title = draft.title ?? draft.headlineOptions?.[0] ?? 'Untitled';

  if (formatted.type === 'note') {
    return await client.createNote({ body: formatted.body });
  } else {
    return await client.createPost({
      title,
      body: formatted.body,
      subtitle: draft.hook ?? '',
    });
  }
}
```

**Step 4: Run test**

```bash
npm test tests/lib/publishing/substack.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/publishing/substack.ts tests/lib/publishing/substack.test.ts
git commit -m "feat: add Substack publisher using substack-api package"
```

---

### Task 7.2: LinkedIn OAuth and publisher

**Files:**
- Create: `src/app/api/auth/linkedin/route.ts`
- Create: `src/app/api/auth/linkedin/callback/route.ts`
- Create: `src/lib/publishing/linkedin.ts`
- Create: `tests/lib/publishing/linkedin.test.ts`

**Step 1: Write failing test**

```typescript
// tests/lib/publishing/linkedin.test.ts
import { describe, it, expect } from 'vitest';
import { formatLinkedInPost } from '@/lib/publishing/linkedin';

describe('formatLinkedInPost', () => {
  it('strips markdown and converts to plain text', () => {
    const result = formatLinkedInPost('**Bold** and _italic_ text\n\n## Heading\n\nBody');
    expect(result).not.toContain('**');
    expect(result).not.toContain('_italic_');
    expect(result).not.toContain('##');
  });

  it('preserves line breaks', () => {
    const result = formatLinkedInPost('Line one\n\nLine two');
    expect(result).toContain('\n');
  });
});
```

**Step 2: Implement `src/lib/publishing/linkedin.ts`**

```typescript
// src/lib/publishing/linkedin.ts
import { decrypt } from '@/lib/crypto';
import type { InferSelectModel } from 'drizzle-orm';
import type { drafts, channels } from '@/db/schema';

type Draft = InferSelectModel<typeof drafts>;
type Channel = InferSelectModel<typeof channels>;

export function formatLinkedInPost(markdown: string): string {
  return markdown
    .replace(/\*\*(.*?)\*\*/g, '$1')      // bold
    .replace(/_(.*?)_/g, '$1')             // italic
    .replace(/`(.*?)`/g, '$1')             // inline code
    .replace(/^#{1,6}\s+/gm, '')           // headings
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // links → text only
    .trim();
}

export async function publishToLinkedIn(draft: Draft, channel: Channel): Promise<unknown> {
  if (!channel.credentials) throw new Error('No LinkedIn credentials configured');

  const encKey = process.env.ENCRYPTION_KEY!;
  const credsJson = decrypt(channel.credentials, encKey);
  if (!credsJson) throw new Error('Failed to decrypt LinkedIn credentials');

  const creds = JSON.parse(credsJson) as { accessToken: string; personId: string };
  const text = formatLinkedInPost(`${draft.hook}\n\n${draft.body}\n\n${draft.cta ?? ''}`);

  const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${creds.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: `urn:li:person:${creds.personId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LinkedIn API error: ${response.status} ${err}`);
  }

  return response.json();
}
```

**Step 3: Implement OAuth flow**

```typescript
// src/app/api/auth/linkedin/route.ts
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get('channelId');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
    scope: 'w_member_social r_liteprofile',
    state: channelId ?? '',
  });

  return NextResponse.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
}
```

```typescript
// src/app/api/auth/linkedin/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { channels } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { encrypt } from '@/lib/crypto';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const channelId = searchParams.get('state');

  // Exchange code for access token
  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code!,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
    }),
  });

  const tokenData = await tokenRes.json();

  // Fetch person ID
  const profileRes = await fetch('https://api.linkedin.com/v2/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = await profileRes.json();

  // Store encrypted credentials
  const creds = { accessToken: tokenData.access_token, personId: profile.id };
  const encrypted = encrypt(JSON.stringify(creds), process.env.ENCRYPTION_KEY!);

  await db.update(channels)
    .set({ credentials: encrypted, platformId: profile.id, updatedAt: new Date() })
    .where(eq(channels.id, channelId!));

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/channels/${channelId}?connected=true`);
}
```

**Step 4: Run test**

```bash
npm test tests/lib/publishing/linkedin.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/publishing/linkedin.ts src/app/api/auth/ tests/lib/publishing/linkedin.test.ts
git commit -m "feat: add LinkedIn OAuth flow and publisher"
```

---

### Task 7.3: Kubernetes CronJob entry points

**Files:**
- Create: `jobs/research-runner.ts`
- Create: `jobs/daily-summary.ts`

**Step 1: Implement `jobs/research-runner.ts`**

```typescript
// jobs/research-runner.ts
// Entry point for the k8s CronJob that runs research for all channels
import 'dotenv/config';
import { db } from '../src/db/client';
import { channels } from '../src/db/schema';
import { runResearchForChannel } from '../src/lib/research/engine';

async function main() {
  console.log('[research-runner] Starting research run for all active channels');

  const allChannels = await db.select().from(channels);

  for (const channel of allChannels) {
    try {
      await runResearchForChannel(channel.id);
      console.log(`[research-runner] Completed channel: ${channel.name}`);
    } catch (err) {
      console.error(`[research-runner] Failed channel ${channel.name}:`, err);
    }
  }

  console.log('[research-runner] Done');
  process.exit(0);
}

main().catch(err => {
  console.error('[research-runner] Fatal:', err);
  process.exit(1);
});
```

**Step 2: Implement `jobs/daily-summary.ts`**

```typescript
// jobs/daily-summary.ts
import 'dotenv/config';
import { db } from '../src/db/client';
import { publishQueue, aiAuditLog, drafts } from '../src/db/schema';
import { gte, eq, sum } from 'drizzle-orm';

async function main() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const published = await db.select()
    .from(publishQueue)
    .where(gte(publishQueue.publishedAt, yesterday));

  const [costRow] = await db.select({ total: sum(aiAuditLog.costUsd) })
    .from(aiAuditLog)
    .where(gte(aiAuditLog.createdAt, yesterday));

  const pending = await db.select()
    .from(drafts)
    .where(eq(drafts.status, 'pending_review'));

  console.log(`[daily-summary] Published yesterday: ${published.length}`);
  console.log(`[daily-summary] AI cost yesterday: $${parseFloat(costRow?.total ?? '0').toFixed(4)}`);
  console.log(`[daily-summary] Drafts awaiting review: ${pending.length}`);

  process.exit(0);
}

main().catch(err => {
  console.error('[daily-summary] Fatal:', err);
  process.exit(1);
});
```

**Step 3: Commit**

```bash
git add jobs/
git commit -m "feat: add research-runner and daily-summary CronJob entry points"
```

---

## Phase 8: Kubernetes / Helm

### Task 8.1: Helm chart structure

**Files:**
- Create: `helm/destink/Chart.yaml`
- Create: `helm/destink/values.yaml`
- Create: `helm/destink/templates/web-deployment.yaml`
- Create: `helm/destink/templates/daemon-deployment.yaml`
- Create: `helm/destink/templates/postgres-statefulset.yaml`
- Create: `helm/destink/templates/research-cronjob.yaml`
- Create: `helm/destink/templates/daily-summary-cronjob.yaml`
- Create: `helm/destink/templates/services.yaml`
- Create: `helm/destink/templates/secrets.yaml`
- Create: `helm/destink/templates/configmap.yaml`

**Step 1: Create `helm/destink/Chart.yaml`**

```yaml
apiVersion: v2
name: destink
description: Personal content automation system
type: application
version: 0.1.0
appVersion: "1.0.0"
```

**Step 2: Create `helm/destink/values.yaml`**

```yaml
image:
  registry: ""          # e.g. ghcr.io/yourusername
  web:
    repository: destink-web
    tag: latest
  daemon:
    repository: destink-daemon
    tag: latest
  jobs:
    repository: destink-jobs
    tag: latest

web:
  port: 3021
  replicas: 1

daemon:
  replicas: 1

postgres:
  enabled: true
  image: postgres:16-alpine
  storage: 5Gi
  database: destink
  username: destink

research:
  schedule: "0 */6 * * *"   # every 6 hours

dailySummary:
  schedule: "0 8 * * *"     # daily at 8am

secrets:
  # Override via helm install --set secrets.databaseUrl=...
  # or use a Kubernetes Secret and reference it
  databaseUrl: ""
  encryptionKey: ""
  anthropicApiKey: ""
  exaApiKey: ""
  linkedinClientId: ""
  linkedinClientSecret: ""
```

**Step 3: Create deployment templates**

`helm/destink/templates/web-deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}-web
spec:
  replicas: {{ .Values.web.replicas }}
  selector:
    matchLabels:
      app: {{ .Release.Name }}-web
  template:
    metadata:
      labels:
        app: {{ .Release.Name }}-web
    spec:
      containers:
        - name: web
          image: "{{ .Values.image.registry }}/{{ .Values.image.web.repository }}:{{ .Values.image.web.tag }}"
          ports:
            - containerPort: {{ .Values.web.port }}
          envFrom:
            - secretRef:
                name: {{ .Release.Name }}-secrets
          env:
            - name: PORT
              value: "{{ .Values.web.port }}"
```

**Step 4: Create CronJob templates**

`helm/destink/templates/research-cronjob.yaml`:
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: {{ .Release.Name }}-research-runner
spec:
  schedule: {{ .Values.research.schedule | quote }}
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: research-runner
              image: "{{ .Values.image.registry }}/{{ .Values.image.jobs.repository }}:{{ .Values.image.jobs.tag }}"
              command: ["npx", "tsx", "jobs/research-runner.ts"]
              envFrom:
                - secretRef:
                    name: {{ .Release.Name }}-secrets
```

**Step 5: Create secrets template**

```yaml
# helm/destink/templates/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: {{ .Release.Name }}-secrets
type: Opaque
stringData:
  DATABASE_URL: {{ .Values.secrets.databaseUrl | quote }}
  ENCRYPTION_KEY: {{ .Values.secrets.encryptionKey | quote }}
  ANTHROPIC_API_KEY: {{ .Values.secrets.anthropicApiKey | quote }}
  EXA_API_KEY: {{ .Values.secrets.exaApiKey | quote }}
  LINKEDIN_CLIENT_ID: {{ .Values.secrets.linkedinClientId | quote }}
  LINKEDIN_CLIENT_SECRET: {{ .Values.secrets.linkedinClientSecret | quote }}
```

**Step 6: Commit**

```bash
git add helm/
git commit -m "feat: add Helm chart for k3s deployment"
```

---

### Task 8.2: k3s deployment guide

**Files:**
- Create: `docs/deployment.md`

**Step 1: Create `docs/deployment.md`**

Document the following setup steps:

1. Install k3s on Mac Mini:
```bash
curl -sfL https://get.k3s.io | sh -
```

2. Build and push Docker images to a local registry:
```bash
# Start local registry (or use GitHub Container Registry)
docker run -d -p 5000:5000 --name registry registry:2

# Build and push
docker build -f docker/Dockerfile.web -t localhost:5000/destink-web:latest .
docker push localhost:5000/destink-web:latest
# Repeat for daemon and jobs images
```

3. Deploy with Helm:
```bash
helm install destink ./helm/destink \
  --set image.registry=localhost:5000 \
  --set secrets.databaseUrl="postgresql://destink:destink@destink-postgres:5432/destink" \
  --set secrets.encryptionKey="$(openssl rand -hex 32)" \
  --set secrets.anthropicApiKey="sk-ant-..." \
  --set secrets.exaApiKey="..."
```

4. Verify pods:
```bash
kubectl get pods
kubectl get cronjobs
```

5. Access the app (from local network):
```bash
kubectl port-forward svc/destink-web 3021:3021
# Or set up an Ingress with the Mac Mini's local IP
```

**Step 2: Commit**

```bash
git add docs/deployment.md
git commit -m "docs: add k3s deployment guide"
```

---

## Phase 8 Final: AI Audit Dashboard

### Task 8.3: AI usage and audit log UI

**Files:**
- Create: `src/app/(app)/audit/page.tsx`
- Create: `src/app/api/audit/route.ts`

**Step 1: Implement audit API**

```typescript
// src/app/api/audit/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { aiAuditLog } from '@/db/schema';
import { desc, gte, sum, count } from 'drizzle-orm';

export async function GET() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [summary] = await db.select({
    totalCost: sum(aiAuditLog.costUsd),
    totalCalls: count(aiAuditLog.id),
  }).from(aiAuditLog).where(gte(aiAuditLog.createdAt, thirtyDaysAgo));

  const recent = await db.select()
    .from(aiAuditLog)
    .orderBy(desc(aiAuditLog.createdAt))
    .limit(100);

  return NextResponse.json({ summary, recent });
}
```

**Step 2: Build audit dashboard page**

Server component showing:
- Total AI spend this month (large number, prominent)
- Spend by operation type (table: research, draft_generation, voice_analysis)
- Recent AI calls log (paginated table)

**Step 3: Commit**

```bash
git add src/app/(app)/audit/ src/app/api/audit/
git commit -m "feat: add AI audit log dashboard"
```

---

## Running Everything Locally

```bash
# Start database
docker compose up db -d

# Run migrations
DATABASE_URL=postgresql://destink:destink@localhost:5432/destink npm run db:migrate

# Start Next.js + daemon together
npm run dev:all

# Open app
open http://localhost:3021
```

## Running Tests

```bash
# All tests
DATABASE_URL=postgresql://destink:destink@localhost:5432/destink npm test

# Specific module
npm test tests/lib/crypto.test.ts
```

---

## Summary of Phases

| Phase | Key deliverable | Est. tasks |
|---|---|---|
| 1 Foundation | Docker Compose, Postgres schema, crypto, AI client | 5 |
| 2 Channels | CRUD API, voice wizard, persona assembly | 3 |
| 3 Research | 4-source engine, AI ranking, topics backlog | 4 |
| 4 Generation | Draft generator, approve/reject/regenerate | 2 |
| 5 Review UI | Draft cards, queue timeline, drag-to-reorder | 2 |
| 6 Scheduling | Time windows, jitter, daemon loop, retry | 2 |
| 7 Publishing | Substack + LinkedIn + OAuth + CronJob entry points | 3 |
| 8 K8s | Helm chart, k3s guide, AI audit dashboard | 3 |
