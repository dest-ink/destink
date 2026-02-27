# Testing Patterns

**Analysis Date:** 2026-02-26

## Test Framework

**Runner:**
- Vitest 4.0.18
- Config: `vitest.config.ts`
- Environment: Node (not browser)
- Test files pattern: `tests/**/*.test.ts`

**Assertion Library:**
- Vitest's built-in expect() API (compatible with Jest)

**Run Commands:**
```bash
npm test                # Run all tests once
npm run test:watch     # Watch mode for development
```

## Test File Organization

**Location:**
- Tests are separated from source code in a parallel `tests/` directory
- Each test file mirrors the source structure: `tests/lib/crypto.test.ts` tests `src/lib/crypto.ts`
- API tests: `tests/api/` mirrors `src/app/api/`
- Database tests: `tests/db/` mirrors `src/db/`

**Naming:**
- Test files: `[module-name].test.ts`
- Examples: `crypto.test.ts`, `scheduler.test.ts`, `engine.test.ts`, `generator.test.ts`

**Structure:**
```
tests/
├── api/
│   ├── channels.test.ts
│   └── voice.test.ts
├── db/
│   └── schema.test.ts
├── daemon/
│   └── daemon.test.ts
└── lib/
    ├── ai/
    │   └── audit.test.ts
    ├── crypto.test.ts
    ├── generation/
    │   └── generator.test.ts
    ├── publishing/
    │   ├── linkedin.test.ts
    │   ├── scheduler.test.ts
    │   └── substack.test.ts
    ├── research/
    │   ├── engine.test.ts
    │   ├── exa.test.ts
    │   ├── orchestrator.test.ts
    │   ├── reddit.test.ts
    │   └── substack-monitor.test.ts
    └── voice/
        ├── analyzer.test.ts
        └── assembler.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '@/lib/crypto';

describe('crypto', () => {
  it('encrypts and decrypts a string round-trip', () => {
    const plaintext = 'my-secret-oauth-token';
    const ciphertext = encrypt(plaintext, KEY);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext, KEY)).toBe(plaintext);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const a = encrypt('hello', KEY);
    const b = encrypt('hello', KEY);
    expect(a).not.toBe(b);
  });
});
```

**Patterns:**

- **Suite setup:** `describe()` groups related tests with a single subject
- **Test naming:** `it()` uses descriptive English sentences describing expected behavior
- **Assertions:** Multiple assertions per test are acceptable when testing a single behavior

**Lifecycle Hooks:**
```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';

describe('channels data layer', () => {
  let channelId: string;

  // Optional: Setup before each test (if needed)
  // beforeEach(() => { ... })

  it('inserts a linkedin channel', async () => {
    // test body
    channelId = ch.id; // Store for cleanup
  });

  // Optional: Cleanup after all tests
  afterAll(async () => {
    if (channelId) {
      await db.delete(channels).where(eq(channels.id, channelId));
    }
  });
});
```

## Mocking

**Framework:** Vitest's `vi` module

**Patterns:**

1. **Module mocking:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/ai/client', () => ({
  callClaude: vi.fn(),
}));

import { generateDraft } from '@/lib/generation/generator';
import { callClaude } from '@/lib/ai/client';

const mockCallClaude = vi.mocked(callClaude);

beforeEach(() => {
  vi.clearAllMocks();
});
```

2. **Mock return values:**
```typescript
const validDraftJson = JSON.stringify({
  headlineOptions: ['Headline A', 'Headline B', 'Headline C'],
  hook: 'AI agents are reshaping engineering.',
  body: 'Full body content here.',
  cta: 'What do you think?',
  voiceConfidence: 78,
});

it('returns GeneratedDraft on success', async () => {
  mockCallClaude.mockResolvedValue(validDraftJson);
  const result = await generateDraft(baseInput, 'chan-id', 'draft-id');
  expect(result.hook).toBe('AI agents are reshaping engineering.');
});
```

3. **Assert mock was called with correct arguments:**
```typescript
expect(mockCallClaude).toHaveBeenCalledWith(
  expect.objectContaining({
    model: 'claude-sonnet-4-6',
    maxTokens: 4096,
    audit: expect.objectContaining({
      operation: 'draft_generation',
      channelId: 'chan-id',
      entityId: 'draft-id',
    }),
  })
);
```

**What to Mock:**
- External service calls (Claude API via `callClaude`)
- Database operations when testing business logic separately
- API calls to third-party services

**What NOT to Mock:**
- Pure functions (they should be tested directly)
- Database schema and type definitions
- Utility functions like `encrypt/decrypt` (test behavior, not implementation)
- Date/time for scheduling tests (test relative positioning, not absolute timestamps)

## Fixtures and Factories

**Test Data:**
```typescript
const testResearchConfig: ResearchConfig = {
  topics: ['AI', 'startups'],
  keywords: ['LLM', 'founder'],
  subreddits: ['r/artificial'],
  substackFeeds: [],
  searchQueryTemplates: ['latest {topic} news'],
  excludedDomains: [],
  contentTypeMix: { note: 70, article: 30 },
  maxDraftsPerRun: 3,
  scheduleHours: 6,
};

const testScheduleConfig: ScheduleConfig = {
  timezone: 'America/New_York',
  minGapHours: 18,
  jitterMinutes: 30,
  timeWindows: [{ dayOfWeek: [2, 3, 4], startHour: 8, endHour: 10 }],
};
```

**Location:**
- Test data defined inline at the top of test files, scoped to the test suite
- Shared constants defined at module level for reuse across test suites
- Example: `const KEY = 'a'.repeat(64);` in crypto tests, `const validDraftJson = ...` in generator tests

## Coverage

**Requirements:** Not enforced (no coverage configuration found)

**View Coverage:**
```bash
# No specific command configured; coverage would require vitest --coverage flag with a coverage provider
# Currently not set up
```

## Test Types

**Unit Tests:**
- **Scope:** Pure functions and utility modules
- **Approach:** Test single function in isolation with various inputs
- **Examples:**
  - `crypto.test.ts` - tests `encrypt()` and `decrypt()` with valid/invalid inputs
  - `scheduler.test.ts` - tests `applyJitter()` and `assignScheduledTime()` with different configs
  - `ai/audit.test.ts` - tests `computeCost()` with different models
- **Location:** `tests/lib/` for most utility tests

**Integration Tests:**
- **Scope:** Multi-component flows with database interaction
- **Approach:** Test end-to-end behavior using actual database (requires DB connection)
- **Examples:**
  - `db/schema.test.ts` - tests insert, retrieve, update, delete on actual channels table
  - `api/channels.test.ts` - tests API route handlers with database
- **Location:** `tests/api/`, `tests/db/`, `tests/daemon/`
- **Note:** These tests execute against a real database and verify data persistence

**E2E Tests:**
- Not implemented (no e2e test framework configured)
- For end-to-end testing, would require separate setup (Playwright, Cypress, etc.)

## Common Patterns

**Async Testing:**
```typescript
// Async test with await on async function
it('returns a date in the future', async () => {
  const scheduled = assignScheduledTime('linkedin', linkedinConfig);
  expect(scheduled.getTime()).toBeGreaterThan(Date.now());
});

// Promise-based test with .rejects
it('throws on invalid JSON response', async () => {
  mockCallClaude.mockResolvedValue('not json');
  await expect(generateDraft(baseInput, 'chan-id', 'draft-id')).rejects.toThrow(/invalid JSON/i);
});
```

**Error Testing:**
```typescript
it('throws when required fields are missing', async () => {
  mockCallClaude.mockResolvedValue(JSON.stringify({ hook: 'Only hook, no body' }));
  await expect(generateDraft(baseInput, 'chan-id', 'draft-id')).rejects.toThrow(/unexpected JSON shape/i);
});

// Test with null returns
it('returns null for tampered ciphertext', () => {
  const ct = encrypt('hello', KEY);
  const tampered = ct.slice(0, -4) + 'xxxx';
  expect(decrypt(tampered, KEY)).toBeNull();
});
```

**Null/Undefined Testing:**
```typescript
it('shows "None" for recent titles when empty', () => {
  const sources: ResearchSource[] = [];
  const prompt = buildAnalysisPrompt(sources, 'A persona', []);
  expect(prompt).toContain('None');
});

it('omits source section when sources array is empty', () => {
  const prompt = buildGenerationPrompt(baseInput);
  expect(prompt).not.toContain('SOURCE MATERIAL');
});
```

**Numeric Range Testing:**
```typescript
it('adds random offset within jitter range', () => {
  const base = new Date('2026-03-10T08:00:00Z');
  const jittered = applyJitter(base, 30);
  const diffMin = (jittered.getTime() - base.getTime()) / 60000;
  expect(diffMin).toBeGreaterThanOrEqual(-30);
  expect(diffMin).toBeLessThan(30); // range is [-30, 30) — upper bound is exclusive
});
```

**Array Assertion:**
```typescript
it('returns GeneratedDraft on success', async () => {
  mockCallClaude.mockResolvedValue(validDraftJson);
  const result = await generateDraft(baseInput, 'chan-id', 'draft-id');
  expect(result.headlineOptions).toHaveLength(3);
});

// Test array contents
it('numbers each source in order', () => {
  const sources: ResearchSource[] = [
    { url: 'https://a.com', title: 'First', summary: 'S1', source: 'exa' },
    { url: 'https://b.com', title: 'Second', summary: 'S2', source: 'reddit' },
  ];
  const prompt = buildAnalysisPrompt(sources, '', []);
  expect(prompt).toContain('[1] First');
  expect(prompt).toContain('[2] Second');
});
```

---

*Testing analysis: 2026-02-26*
