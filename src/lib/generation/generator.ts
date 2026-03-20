import { callClaude } from '@/lib/ai/client';
import type { ResearchSource } from '@/db/schema';

export interface WritingStylePrefs {
  noteLengthMin?: number | null;
  noteLengthMax?: number | null;
  articleLengthMin?: number | null;
  articleLengthMax?: number | null;
  vocabularyLevel?: string | null;
  jargonHandling?: string | null;
  preferredPhrases?: string[] | null;
  avoidedPhrases?: string[] | null;
  useEmDashes?: boolean | null;
  useOxfordComma?: boolean | null;
  useSemicolons?: boolean | null;
  useExclamationMarks?: boolean | null;
  useEllipsis?: boolean | null;
  useParenheticals?: boolean | null;
  headlineCase?: string | null;
  emphasisStyle?: string | null;
  useAllCaps?: boolean | null;
  paragraphLength?: string | null;
  useSubheadings?: boolean | null;
  useBulletLists?: boolean | null;
  useNumberedLists?: boolean | null;
  useBlockquotes?: boolean | null;
  humorLevel?: string | null;
  formalityLevel?: string | null;
  opinionStrength?: string | null;
  ctaStyle?: string | null;
}

export interface GenerationInput {
  contentType: 'note' | 'article';
  personaPrompt: string;
  topicTitle: string;
  topicAngle: string;
  sources: ResearchSource[];
  recentTitles: string[];
  regenerationNote?: string;
  platform?: 'linkedin' | 'substack';
  writingStyle?: WritingStylePrefs;
}

export interface GeneratedDraft {
  headlineOptions: string[];
  hook: string;
  body: string;
  cta: string;
  voiceConfidence: number;
}

/**
 * Builds the generation prompt. Pure function — no I/O.
 */
function buildWritingStyleInstructions(ws: WritingStylePrefs, contentType: 'note' | 'article'): string {
  const rules: string[] = [];

  // Length
  const min = contentType === 'note' ? (ws.noteLengthMin ?? 150) : (ws.articleLengthMin ?? 800);
  const max = contentType === 'note' ? (ws.noteLengthMax ?? 300) : (ws.articleLengthMax ?? 2000);
  rules.push(`Target length: ${min}–${max} words`);

  // Vocabulary
  if (ws.vocabularyLevel) rules.push(`Vocabulary: ${ws.vocabularyLevel}`);
  if (ws.jargonHandling === 'avoid') rules.push('Avoid jargon and technical terms');
  else if (ws.jargonHandling === 'explain') rules.push('When using jargon, explain it on first use');
  else if (ws.jargonHandling === 'assume-knowledge') rules.push('Assume reader knows industry jargon');

  if (ws.preferredPhrases?.length) rules.push(`Preferred phrases to use: ${ws.preferredPhrases.join(', ')}`);
  if (ws.avoidedPhrases?.length) rules.push(`NEVER use these phrases: ${ws.avoidedPhrases.join(', ')}`);

  // Punctuation
  const punctRules: string[] = [];
  if (ws.useEmDashes) punctRules.push('use em dashes (—) for asides');
  if (ws.useOxfordComma) punctRules.push('use Oxford comma');
  if (!ws.useSemicolons) punctRules.push('avoid semicolons');
  if (!ws.useExclamationMarks) punctRules.push('no exclamation marks');
  if (!ws.useEllipsis) punctRules.push('no ellipsis');
  if (ws.useParenheticals) punctRules.push('parenthetical asides OK');
  if (punctRules.length) rules.push(`Punctuation: ${punctRules.join('; ')}`);

  // Capitalization
  if (ws.headlineCase) rules.push(`Headlines: ${ws.headlineCase} case`);
  if (ws.emphasisStyle) rules.push(`Emphasis: use ${ws.emphasisStyle === 'bold' ? '**bold**' : ws.emphasisStyle === 'italic' ? '*italic*' : ws.emphasisStyle === 'caps' ? 'ALL CAPS' : 'no'} formatting for emphasis`);
  if (ws.useAllCaps) rules.push('Use strategic ALL CAPS for 1-2 key words per post');

  // Structure
  if (ws.paragraphLength === 'short') rules.push('Keep paragraphs to 2-3 sentences');
  else if (ws.paragraphLength === 'medium') rules.push('Paragraphs can be 4-5 sentences');
  else if (ws.paragraphLength === 'long') rules.push('Longer paragraphs (6+) are OK');

  const structRules: string[] = [];
  if (ws.useSubheadings) structRules.push('use ## subheadings');
  if (ws.useBulletLists) structRules.push('use bullet lists');
  if (ws.useNumberedLists) structRules.push('use numbered lists');
  if (ws.useBlockquotes) structRules.push('use > blockquotes for key insights');
  if (structRules.length) rules.push(`Structure: ${structRules.join(', ')}`);

  // Tone
  if (ws.humorLevel && ws.humorLevel !== 'none') rules.push(`Humor: ${ws.humorLevel}`);
  if (ws.formalityLevel) rules.push(`Formality: ${ws.formalityLevel}`);
  if (ws.opinionStrength) rules.push(`Opinion: ${ws.opinionStrength}`);
  if (ws.ctaStyle === 'question') rules.push('End with an engaging question');
  else if (ws.ctaStyle === 'directive') rules.push('End with a direct CTA (share, comment, etc.)');
  else if (ws.ctaStyle === 'soft') rules.push('End with a soft nudge');
  else if (ws.ctaStyle === 'none') rules.push('No call-to-action needed');

  return rules.length > 0
    ? `\n\nWRITING STYLE RULES:\n${rules.map(r => `- ${r}`).join('\n')}`
    : '';
}

const PLATFORM_FORMATTING: Record<string, string> = {
  linkedin: `FORMATTING RULES (LinkedIn):
- Use plain text only — NO markdown, NO HTML, NO hashtags at the start
- Use line breaks for paragraph separation (\\n\\n)
- Use unicode characters for emphasis: bold text can use strategic ALL CAPS for 1-2 key words
- Use "→" arrows, "•" bullets, and "—" em dashes for structure
- Start with a strong hook line, then a line break
- Keep paragraphs to 2-3 sentences max for mobile readability
- End with a clear CTA or question to drive engagement`,

  substack: `FORMATTING RULES (Substack):
- Use markdown formatting: **bold**, *italic*, ## headings, > blockquotes
- Use ## for section headings (not #, which is the title)
- Use --- for section breaks
- Use bullet lists with - for enumeration
- Use > for pull quotes or key insights
- Use **bold** for key terms and emphasis
- Structure with clear sections: intro, main argument sections, conclusion
- Include transition sentences between sections`,
};

export function buildGenerationPrompt(input: GenerationInput): string {
  const { contentType, personaPrompt, topicTitle, topicAngle, sources, recentTitles, regenerationNote, platform, writingStyle } = input;

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

  const formattingRules = platform && PLATFORM_FORMATTING[platform]
    ? `\n\n${PLATFORM_FORMATTING[platform]}`
    : '';

  const styleRules = writingStyle ? buildWritingStyleInstructions(writingStyle, contentType) : '';

  return `${personaPrompt}

TASK: Write a ${contentType} about "${topicTitle}".
ANGLE: ${topicAngle}
LENGTH/FORMAT: ${spec}${formattingRules}${styleRules}${sourceContext}${recentContext}${regenContext}

Return ONLY valid JSON:
{
  "headlineOptions": ["Option A", "Option B", "Option C"],
  "hook": "First 1-2 sentences that stop the scroll",
  "body": "Full content here (follow the formatting rules above)",
  "cta": "Call to action appropriate for the platform",
  "voiceConfidence": 85
}

voiceConfidence is your self-assessment (0-100) of how well this matches the persona. Flag anything below 60.`;
}

/**
 * Calls Claude to generate a draft and returns the structured content.
 * Callers are responsible for persisting to the DB.
 */
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Draft generation returned invalid JSON: ${raw.slice(0, 200)}`);
  }

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

  return draft;
}
