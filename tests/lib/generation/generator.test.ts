import { describe, it, expect } from 'vitest';
import { buildGenerationPrompt } from '@/lib/generation/generator';
import type { GenerationInput } from '@/lib/generation/generator';

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
