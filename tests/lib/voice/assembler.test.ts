import { describe, it, expect } from 'vitest';
import { buildPersonaFromWizard } from '@/lib/voice/assembler';

describe('buildPersonaFromWizard', () => {
  it('includes wizard answers in the assembled prompt', () => {
    const answers = [
      { question: 'Describe your style in 3 words', answer: 'direct, analytical, contrarian' },
      { question: 'Who is your ideal reader?', answer: 'Technical founders' },
    ];
    const prompt = buildPersonaFromWizard(answers);
    expect(prompt).toContain('direct, analytical, contrarian');
    expect(prompt).toContain('Technical founders');
  });

  it('returns a non-empty string for empty answers', () => {
    const prompt = buildPersonaFromWizard([]);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });
});
