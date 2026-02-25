import { describe, it, expect } from 'vitest';
import { buildPersonaFromWizard } from '@/lib/voice/assembler';

describe('buildPersonaFromWizard', () => {
  it('includes wizard answers in the assembled body', () => {
    const answers = [
      { question: 'Describe your style in 3 words', answer: 'direct, analytical, contrarian' },
      { question: 'Who is your ideal reader?', answer: 'Technical founders' },
    ];
    const body = buildPersonaFromWizard(answers);
    expect(body).toContain('direct, analytical, contrarian');
    expect(body).toContain('Technical founders');
  });

  it('returns an empty string for empty answers (assembler applies default)', () => {
    const body = buildPersonaFromWizard([]);
    expect(body).toBe('');
  });

  it('returns an empty string when all answers are blank/whitespace', () => {
    const body = buildPersonaFromWizard([
      { question: 'Style?', answer: '   ' },
      { question: 'Topics?', answer: '' },
    ]);
    expect(body).toBe('');
  });

  it('omits blank answers but includes non-blank ones', () => {
    const body = buildPersonaFromWizard([
      { question: 'Style?', answer: 'direct' },
      { question: 'Topics?', answer: '' },
    ]);
    expect(body).toContain('direct');
    expect(body).not.toContain('Topics?');
  });
});
