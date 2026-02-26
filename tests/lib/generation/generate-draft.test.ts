import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ResearchSource } from '@/db/schema';

// ── Mocks (must be declared before the module under test is imported) ─────────

const mockInsertValues = vi.fn();
const mockInsertReturning = vi.fn();

vi.mock('@/db/client', () => ({
  db: {
    insert: vi.fn(() => ({
      values: mockInsertValues.mockReturnValue({
        returning: mockInsertReturning,
      }),
    })),
  },
}));

// Mock callClaude (which wraps Anthropic SDK + audit internally)
vi.mock('@/lib/ai/client', () => ({
  callClaude: vi.fn(),
}));

// ── Import after mocks are registered ─────────────────────────────────────────

import { generateDraft } from '@/lib/generation/generate-draft';
import { callClaude } from '@/lib/ai/client';

const mockCallClaude = vi.mocked(callClaude);

// ── Test fixtures ─────────────────────────────────────────────────────────────

const sources: ResearchSource[] = [
  {
    url: 'https://example.com/ai-agents',
    title: 'AI Agents Are Taking Over',
    summary: 'A deep-dive into autonomous AI agents changing the software industry.',
    source: 'exa',
  },
  {
    url: 'https://reddit.com/r/MachineLearning/post1',
    title: 'Discussion: LLM limitations',
    summary: 'Community discussion on the practical limits of large language models.',
    source: 'reddit',
  },
];

const baseParams = {
  channelId: '00000000-0000-0000-0000-000000000001',
  personaPrompt: 'You write direct, opinionated posts for senior engineers.',
  sources,
  contentType: 'note' as const,
};

const validDraftJson = JSON.stringify({
  title: null,
  headlineOptions: ['Headline A', 'Headline B', 'Headline C'],
  hook: 'AI agents are here and most engineers are not ready.',
  body: 'The body of the post goes here with insights and opinions.',
  cta: 'What are you building with agents? Let me know below.',
  voiceConfidence: 82,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: successful insert returning a UUID row
  mockInsertReturning.mockResolvedValue([{ id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }]);
});

describe('generateDraft', () => {
  it('returns a draft UUID on success', async () => {
    mockCallClaude.mockResolvedValue(validDraftJson);

    const id = await generateDraft(baseParams);

    // Should return a UUID-shaped string
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    // db.insert should have been called (once for drafts)
    const { db } = await import('@/db/client');
    expect(db.insert).toHaveBeenCalledOnce();
  });

  it('throws on malformed Claude response', async () => {
    mockCallClaude.mockResolvedValue('not json at all');

    await expect(generateDraft(baseParams)).rejects.toThrow(/invalid JSON/i);
  });

  it('calls callClaude once after successful generation', async () => {
    mockCallClaude.mockResolvedValue(validDraftJson);

    await generateDraft(baseParams);

    expect(mockCallClaude).toHaveBeenCalledOnce();
    expect(mockCallClaude).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 2000,
        audit: expect.objectContaining({
          operation: 'draft_generation',
          channelId: baseParams.channelId,
        }),
      })
    );
  });

  it('throws when JSON is valid but missing required fields', async () => {
    // Valid JSON but lacks hook and body
    mockCallClaude.mockResolvedValue(JSON.stringify({ title: 'Only a title' }));

    await expect(generateDraft(baseParams)).rejects.toThrow(/unexpected JSON shape/i);
  });
});
