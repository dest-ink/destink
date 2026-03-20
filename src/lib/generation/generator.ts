import { callClaude } from '@/lib/ai/client';
import { getModelForUseCase } from '@/lib/ai/model-settings';
import type { ResearchSource, ContentTypeStyle } from '@/db/schema';

export type { ContentTypeStyle as WritingStylePrefs } from '@/db/schema';

export interface GenerationInput {
  contentType: 'note' | 'article';
  personaPrompt: string;
  topicTitle: string;
  topicAngle: string;
  sources: ResearchSource[];
  recentTitles: string[];
  regenerationNote?: string;
  platform?: 'linkedin' | 'substack';
  writingStyle?: ContentTypeStyle | null;
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
function buildWritingStyleInstructions(ws: ContentTypeStyle): string {
  const rules: string[] = [];

  // Vocabulary & language
  rules.push(`Vocabulary level: ${ws.vocabularyLevel ?? 'accessible'}`);
  if (ws.jargonHandling === 'avoid') rules.push('Do NOT use jargon or technical terms');
  else if (ws.jargonHandling === 'explain') rules.push('When using jargon, explain it on first use');
  else if (ws.jargonHandling === 'assume-knowledge') rules.push('Assume reader knows industry jargon');
  if (ws.preferredPhrases?.length) rules.push(`Use these phrases when natural: ${ws.preferredPhrases.join(', ')}`);
  if (ws.avoidedPhrases?.length) rules.push(`NEVER use these phrases: ${ws.avoidedPhrases.join(', ')}`);

  // Punctuation — be explicit about both what to use AND what to avoid
  const usePunct: string[] = [];
  const avoidPunct: string[] = [];
  ws.useEmDashes ? usePunct.push('em dashes (—)') : avoidPunct.push('em dashes');
  ws.useOxfordComma ? usePunct.push('Oxford comma') : avoidPunct.push('Oxford comma');
  ws.useSemicolons ? usePunct.push('semicolons') : avoidPunct.push('semicolons');
  ws.useExclamationMarks ? usePunct.push('exclamation marks') : avoidPunct.push('exclamation marks');
  ws.useEllipsis ? usePunct.push('ellipsis (...)') : avoidPunct.push('ellipsis');
  ws.useParenheticals ? usePunct.push('parenthetical asides') : avoidPunct.push('parenthetical asides');
  if (usePunct.length) rules.push(`Punctuation to USE: ${usePunct.join(', ')}`);
  if (avoidPunct.length) rules.push(`Punctuation to AVOID: ${avoidPunct.join(', ')}`);

  // Capitalization & emphasis
  rules.push(`Headlines: ${ws.headlineCase ?? 'sentence'} case`);
  const emphMap: Record<string, string> = { bold: '**bold**', italic: '*italic*', caps: 'ALL CAPS', none: 'no special' };
  rules.push(`Emphasis: use ${emphMap[ws.emphasisStyle ?? 'bold'] ?? 'bold'} formatting`);
  if (ws.useAllCaps) rules.push('Use strategic ALL CAPS for 1-2 key words per post');
  if (!ws.useAllCaps) rules.push('Do NOT use ALL CAPS');

  // Structure
  const paraMap: Record<string, string> = { short: '2-3 sentences max', medium: '4-5 sentences', long: '6+ sentences OK' };
  rules.push(`Paragraph length: ${paraMap[ws.paragraphLength ?? 'short'] ?? '2-3 sentences'}`);
  const useStruct: string[] = [];
  const avoidStruct: string[] = [];
  ws.useSubheadings ? useStruct.push('## subheadings') : avoidStruct.push('subheadings');
  ws.useBulletLists ? useStruct.push('bullet lists (-)') : avoidStruct.push('bullet lists');
  ws.useNumberedLists ? useStruct.push('numbered lists (1. 2. 3.)') : avoidStruct.push('numbered lists');
  ws.useBlockquotes ? useStruct.push('> blockquotes') : avoidStruct.push('blockquotes');
  if (useStruct.length) rules.push(`Structure elements to USE: ${useStruct.join(', ')}`);
  if (avoidStruct.length) rules.push(`Structure elements to AVOID: ${avoidStruct.join(', ')}`);

  // Tone
  rules.push(`Humor: ${ws.humorLevel ?? 'none'}`);
  rules.push(`Formality: ${ws.formalityLevel ?? 'conversational'}`);
  rules.push(`Opinion strength: ${ws.opinionStrength ?? 'balanced'}`);
  if (ws.ctaStyle === 'question') rules.push('End with an engaging question');
  else if (ws.ctaStyle === 'directive') rules.push('End with a direct CTA (share, comment, etc.)');
  else if (ws.ctaStyle === 'soft') rules.push('End with a soft nudge');
  else if (ws.ctaStyle === 'none') rules.push('Do NOT include a call-to-action');

  return `\n\nWRITING STYLE RULES (follow ALL of these precisely):\n${rules.map(r => `- ${r}`).join('\n')}`;
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

  // Use writing style length if available, otherwise fall back to defaults
  const lengthMin = writingStyle?.lengthMin ?? (contentType === 'note' ? 150 : 800);
  const lengthMax = writingStyle?.lengthMax ?? (contentType === 'note' ? 300 : 2000);

  const spec = `EXACTLY ${lengthMin}–${lengthMax} words.`;

  const styleRules = writingStyle ? buildWritingStyleInstructions(writingStyle) : '';

  // Only use hardcoded platform formatting if no writing style is configured
  const formattingRules = !writingStyle && platform && PLATFORM_FORMATTING[platform]
    ? `\n\n${PLATFORM_FORMATTING[platform]}`
    : '';

  return `${personaPrompt}

IMPORTANT: Your voice profile defines your STYLE of writing (tone, beliefs, humor). It does NOT define WHAT you write about. Write about the specific topic below, not about your personal beliefs or recurring themes. Bring variety and fresh angles.

TASK: Write a ${contentType} about "${topicTitle}".
ANGLE: ${topicAngle}
LENGTH: ${spec} THIS IS A HARD LIMIT — do NOT exceed ${lengthMax} words.${formattingRules}${styleRules}${sourceContext}${recentContext}${regenContext}

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
  draftId: string,
  userId: string
): Promise<GeneratedDraft> {
  const prompt = buildGenerationPrompt(input);
  const model = await getModelForUseCase(userId, 'draftGeneration');
  const raw = await callClaude({
    model,
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
