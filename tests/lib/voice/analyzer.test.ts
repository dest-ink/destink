import { describe, it, expect } from 'vitest';
import { buildVoiceAnalysisPrompt } from '@/lib/voice/analyzer';

describe('buildVoiceAnalysisPrompt', () => {
  it('includes all sample texts in the output', () => {
    const samples = ['First article content here.', 'Second article content here.'];
    const prompt = buildVoiceAnalysisPrompt(samples);
    expect(prompt).toContain('First article content here.');
    expect(prompt).toContain('Second article content here.');
  });

  it('requests JSON output with required fields', () => {
    const prompt = buildVoiceAnalysisPrompt(['sample']);
    expect(prompt).toContain('toneDescriptors');
    expect(prompt).toContain('recurringThemes');
    expect(prompt).toContain('topicsToAvoid');
    expect(prompt).toContain('idealReader');
  });

  it('labels each sample with a number', () => {
    const prompt = buildVoiceAnalysisPrompt(['A', 'B', 'C']);
    expect(prompt).toContain('Sample 1');
    expect(prompt).toContain('Sample 2');
    expect(prompt).toContain('Sample 3');
  });
});
