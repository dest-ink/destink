import { describe, it, expect } from 'vitest';
import { buildAnalysisPrompt } from '@/lib/research/engine';
import type { ResearchSource } from '@/db/schema';

describe('buildAnalysisPrompt', () => {
  it('includes source titles and summaries in the prompt', () => {
    const sources: ResearchSource[] = [
      { url: 'https://a.com', title: 'Test Article', summary: 'Summary here', source: 'exa' },
    ];
    const prompt = buildAnalysisPrompt(sources, 'A developer persona', []);
    expect(prompt).toContain('Test Article');
    expect(prompt).toContain('Summary here');
    expect(prompt).toContain('relevanceScore');
  });

  it('includes the persona prompt', () => {
    const sources: ResearchSource[] = [];
    const prompt = buildAnalysisPrompt(sources, 'Opinionated founder voice', []);
    expect(prompt).toContain('Opinionated founder voice');
  });

  it('includes recent titles when provided', () => {
    const sources: ResearchSource[] = [];
    const prompt = buildAnalysisPrompt(sources, 'A persona', ['My previous post title']);
    expect(prompt).toContain('My previous post title');
  });

  it('shows "None" for recent titles when empty', () => {
    const sources: ResearchSource[] = [];
    const prompt = buildAnalysisPrompt(sources, 'A persona', []);
    expect(prompt).toContain('None');
  });

  it('numbers each source in order', () => {
    const sources: ResearchSource[] = [
      { url: 'https://a.com', title: 'First', summary: 'S1', source: 'exa' },
      { url: 'https://b.com', title: 'Second', summary: 'S2', source: 'reddit' },
    ];
    const prompt = buildAnalysisPrompt(sources, '', []);
    expect(prompt).toContain('[1] First');
    expect(prompt).toContain('[2] Second');
  });
});
