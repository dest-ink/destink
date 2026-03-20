import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildGenerationPrompt } from '@/lib/generation/generator';
import type { GenerationInput } from '@/lib/generation/generator';

// Mocks for generateDraft tests
vi.mock('@/lib/ai/client', () => ({
  callClaude: vi.fn(),
}));

vi.mock('@/lib/ai/model-settings', () => ({
  getModelForUseCase: vi.fn().mockResolvedValue('claude-sonnet-4-6'),
}));

import { generateDraft } from '@/lib/generation/generator';
import { callClaude } from '@/lib/ai/client';

const mockCallClaude = vi.mocked(callClaude);

beforeEach(() => {
  vi.clearAllMocks();
});

const baseInput: GenerationInput = {
  contentType: 'note',
  personaPrompt: 'Direct, analytical voice.',
  topicTitle: 'AI and remote work',
  topicAngle: 'Contrarian take',
  sources: [],
  recentTitles: [],
};

describe('buildGenerationPrompt', () => {
  it('includes content type spec for notes', () => {
    const prompt = buildGenerationPrompt(baseInput);
    expect(prompt).toContain('150–300 words');
    expect(prompt).toContain('AI and remote work');
  });

  it('includes content type spec for articles', () => {
    const prompt = buildGenerationPrompt({ ...baseInput, contentType: 'article' });
    expect(prompt).toContain('800–2000 words');
  });

  it('includes persona prompt', () => {
    const prompt = buildGenerationPrompt(baseInput);
    expect(prompt).toContain('Direct, analytical voice.');
  });

  it('includes topic angle', () => {
    const prompt = buildGenerationPrompt(baseInput);
    expect(prompt).toContain('Contrarian take');
  });

  it('includes source summaries when provided', () => {
    const withSources: GenerationInput = {
      ...baseInput,
      sources: [
        { url: 'https://a.com', title: 'AI Study', summary: 'Agents are replacing jobs', source: 'exa' },
      ],
    };
    const prompt = buildGenerationPrompt(withSources);
    expect(prompt).toContain('AI Study');
    expect(prompt).toContain('Agents are replacing jobs');
  });

  it('includes recent titles when provided', () => {
    const prompt = buildGenerationPrompt({ ...baseInput, recentTitles: ['My last post'] });
    expect(prompt).toContain('My last post');
  });

  it('includes regeneration note when provided', () => {
    const prompt = buildGenerationPrompt({ ...baseInput, regenerationNote: 'Make it punchier' });
    expect(prompt).toContain('Make it punchier');
  });

  it('omits source section when sources array is empty', () => {
    const prompt = buildGenerationPrompt(baseInput);
    expect(prompt).not.toContain('SOURCE MATERIAL');
  });

  it('omits recent posts section when recentTitles is empty', () => {
    const prompt = buildGenerationPrompt(baseInput);
    expect(prompt).not.toContain('RECENT POSTS');
  });
});

const validDraftJson = JSON.stringify({
  headlineOptions: ['Headline A', 'Headline B', 'Headline C'],
  hook: 'AI agents are reshaping engineering.',
  body: 'Full body content here.',
  cta: 'What do you think?',
  voiceConfidence: 78,
});

describe('generateDraft', () => {
  it('returns GeneratedDraft on success', async () => {
    mockCallClaude.mockResolvedValue(validDraftJson);

    const result = await generateDraft(baseInput, 'chan-id', 'draft-id', 'user-id');

    expect(result.hook).toBe('AI agents are reshaping engineering.');
    expect(result.body).toBe('Full body content here.');
    expect(result.cta).toBe('What do you think?');
    expect(result.voiceConfidence).toBe(78);
    expect(result.headlineOptions).toHaveLength(3);
  });

  it('calls callClaude with claude-sonnet-4-6 and correct audit fields', async () => {
    mockCallClaude.mockResolvedValue(validDraftJson);

    await generateDraft(baseInput, 'chan-id', 'draft-id', 'user-id');

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
  });

  it('throws on invalid JSON response', async () => {
    mockCallClaude.mockResolvedValue('not json');
    await expect(generateDraft(baseInput, 'chan-id', 'draft-id', 'user-id')).rejects.toThrow(/invalid JSON/i);
  });

  it('throws when required fields are missing', async () => {
    mockCallClaude.mockResolvedValue(JSON.stringify({ hook: 'Only hook, no body' }));
    await expect(generateDraft(baseInput, 'chan-id', 'draft-id', 'user-id')).rejects.toThrow(/unexpected JSON shape/i);
  });

  it('throws when cta is missing', async () => {
    mockCallClaude.mockResolvedValue(JSON.stringify({
      headlineOptions: ['H1'],
      hook: 'hook',
      body: 'body',
      voiceConfidence: 80,
      // cta missing
    }));
    await expect(generateDraft(baseInput, 'chan-id', 'draft-id', 'user-id')).rejects.toThrow(/unexpected JSON shape/i);
  });

  it('throws when voiceConfidence is not a number', async () => {
    mockCallClaude.mockResolvedValue(JSON.stringify({
      headlineOptions: ['H1'],
      hook: 'hook',
      body: 'body',
      cta: 'cta',
      voiceConfidence: 'high', // wrong type
    }));
    await expect(generateDraft(baseInput, 'chan-id', 'draft-id', 'user-id')).rejects.toThrow(/unexpected JSON shape/i);
  });
});
