# Coding Conventions

**Analysis Date:** 2026-02-26

## Naming Patterns

**Files:**
- Components: PascalCase (e.g., `ChannelCard.tsx`, `DraftDetailPanel.tsx`)
- Utilities and modules: camelCase (e.g., `scheduler.ts`, `generator.ts`)
- Database/schema files: camelCase (e.g., `client.ts`, `schema.ts`)
- Pages: lowercase with hyphens for routes (e.g., `channels/page.tsx`, `[id]/page.tsx`)
- API routes: lowercase with underscores in filenames when needed (e.g., `route.ts`)

**Functions:**
- camelCase for all functions: `encrypt()`, `decrypt()`, `buildAnalysisPrompt()`, `runResearchForChannel()`, `assignScheduledTime()`, `applyJitter()`
- Pure functions often prefixed with "build" when constructing prompts or data: `buildAnalysisPrompt()`, `buildGenerationPrompt()`
- Async functions named as verbs: `generateDraft()`, `callClaude()`, `searchExa()`, `monitorSubstackFeeds()`

**Variables:**
- camelCase for all variables: `plaintext`, `ciphertext`, `channelId`, `voiceProfile`, `recentTitles`
- Constants in UPPER_SNAKE_CASE when defined at module level: `ALGORITHM`, `IV_BYTES`, `TAG_BYTES`, `PLATFORM_STYLES`, `DEFAULT_WINDOWS`
- Type names: PascalCase (e.g., `GenerationInput`, `GeneratedDraft`, `DraftWithChannel`)

**Types:**
- Interfaces and types: PascalCase
- Inferred database row types use the pattern `typeof tableName.$inferSelect` (e.g., `type DraftRow = typeof drafts.$inferSelect`)
- Union types: PascalCase (e.g., `ClaudeModel`, `ResearchSource`)

## Code Style

**Formatting:**
- No explicit formatter is enforced (no Prettier config found)
- Target: ES2017, with JSX as react-jsx
- Imports organized by source: external packages first, then relative imports

**Linting:**
- ESLint enabled with Next.js core-web-vitals and TypeScript config (`eslint-config-next`)
- Config: `eslint.config.mjs` (flat config format)
- Ignored paths: `.next/**`, `out/**`, `build/**`, `next-env.d.ts`

## Import Organization

**Order:**
1. External package imports (standard library like `crypto`, npm packages like `@anthropic-ai/sdk`)
2. Relative imports from `@/` aliases
3. Type imports using `type` keyword

**Example from `src/lib/generation/generator.ts`:**
```typescript
import { callClaude } from '@/lib/ai/client';
import type { ResearchSource } from '@/db/schema';
```

**Example from `src/app/api/channels/route.ts`:**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { channels } from '@/db/schema';
import { desc } from 'drizzle-orm';
```

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- All imports use the `@/` prefix for code in `src/`

## Error Handling

**Pattern: Try-Catch with Null/Error Returns:**
- Crypto operations catch and return `null` on invalid input:
  ```typescript
  export function decrypt(ciphertext: string, keyHex: string): string | null {
    try {
      // validation and decryption logic
      return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
    } catch {
      return null;
    }
  }
  ```

**Pattern: Try-Catch with Error Throws:**
- JSON parsing and validation throws errors with context:
  ```typescript
  try {
    topics = JSON.parse(raw) as TopicRecommendation[];
  } catch {
    throw new Error(`[runResearchForChannel] Claude returned invalid JSON: ${raw.slice(0, 200)}`);
  }
  ```

**Pattern: Data Validation After Parsing:**
- After JSON parsing, explicitly validate all required fields before use:
  ```typescript
  const draft = parsed as GeneratedDraft;
  if (
    typeof draft !== 'object' ||
    draft === null ||
    !Array.isArray(draft.headlineOptions) ||
    typeof draft.hook !== 'string' ||
    typeof draft.body !== 'string' ||
    typeof draft.cta !== 'string' ||
    typeof draft.voiceConfidence !== 'number'
  ) {
    throw new Error(`Draft generation returned unexpected JSON shape: ${raw.slice(0, 200)}`);
  }
  ```

**Pattern: API Routes Return NextResponse with Status:**
- Success: `return NextResponse.json(data, { status: 201 })`
- Validation error: `return NextResponse.json({ error: 'message' }, { status: 400 })`
- Server error: `return NextResponse.json({ error: 'Internal server error' }, { status: 500 })`
- All routes wrapped in try-catch that catches all errors and returns 500

**Pattern: Async Operation Failure Handling:**
- Audit operations that fail don't mask successful main operations:
  ```typescript
  try {
    await logAiCall({...});
  } catch (err) {
    // Audit failure must never mask a successful AI response
    console.error('[callClaude] audit log failed:', err);
  }
  ```

## Logging

**Framework:** `console` (no dedicated logging library)

**Patterns:**
- Log with module/function context prefix: `console.log('[research] Channel ${channelId}: found ${topics.length} topics')`
- Error logs use `console.error` with context: `console.error('[callClaude] audit log failed:', err)`
- Prefix format: `[module_or_context]` at the start of message

## Comments

**When to Comment:**
- JSDoc style comments for exported functions and their behavior:
  ```typescript
  /**
   * Encrypts plaintext using AES-256-GCM.
   * Output format: <iv-hex>:<tag-hex>:<ciphertext-hex>
   */
  export function encrypt(plaintext: string, keyHex: string): string {
  ```

- Inline comments for non-obvious algorithm choices or invariants:
  ```typescript
  // candidateBase is never mutated so that multiple windows on the same day
  // each get a clean starting point for setHours.
  const candidateBase = new Date(now);
  ```

- Section headers with dashes for major groupings (in schema):
  ```typescript
  // ─── Enums ───────────────────────────────────────────────────────────────────
  // ─── Tables ──────────────────────────────────────────────────────────────────
  // ─── JSON column types ────────────────────────────────────────────────────────
  ```

**JSDoc/TSDoc:**
- Used for all exported functions
- Describes parameter behavior and return value
- Notes assumptions or side effects
- Example from `src/lib/crypto.ts`:
  ```typescript
  /**
   * Decrypts ciphertext produced by encrypt().
   * Returns null if the input is invalid or tampered.
   */
  export function decrypt(ciphertext: string, keyHex: string): string | null {
  ```

## Function Design

**Size:**
- Functions are kept focused and reasonably short
- Complex operations broken into smaller pure functions (`buildAnalysisPrompt`, `buildGenerationPrompt`)
- Business logic functions (10-30 lines) separated from data-fetching async functions

**Parameters:**
- Use object parameters for complex options:
  ```typescript
  export interface CallClaudeOptions {
    model: ClaudeModel;
    system: string;
    prompt: string;
    maxTokens?: number;
    audit: Omit<AuditEntry, 'model' | 'promptTokens' | 'completionTokens'>;
  }
  ```

**Return Values:**
- Explicit return types on all public functions
- Union types for nullable returns: `string | null`
- Generic array returns: `ResearchSource[]`
- Component functions return JSX elements (implicit return type)

## Module Design

**Exports:**
- Named exports for utility functions: `export function encrypt(...)`
- Default exports for React components: `export function ChannelCard(...)`
- Type exports use `export type` or `export interface`: `export type ClaudeModel = ...`
- Enum exports: `export const platformEnum = pgEnum('platform', [...])`

**Barrel Files:**
- Not used in source code (no index.ts files re-exporting modules)
- Each file is imported directly by path

**Separation of Concerns:**
- UI components in `src/components/`
- Database operations (schema, client) in `src/db/`
- Business logic in `src/lib/` organized by domain (ai, research, publishing, generation, voice, crypto)
- API routes in `src/app/api/`
- Page components in `src/app/(app)/`

---

*Convention analysis: 2026-02-26*
