import { callClaude } from '@/lib/ai/client';
import type { ResearchSource } from '@/db/schema';

export interface GenerationInput {
  contentType: 'note' | 'article';
  personaPrompt: string;
  topicTitle: string;
  topicAngle: string;
  sources: ResearchSource[];
  recentTitles: string[];
  regenerationNote?: string;
  platform?: 'linkedin' | 'substack';
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
  const { contentType, personaPrompt, topicTitle, topicAngle, sources, recentTitles, regenerationNote, platform } = input;

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

  return `${personaPrompt}

TASK: Write a ${contentType} about "${topicTitle}".
ANGLE: ${topicAngle}
LENGTH/FORMAT: ${spec}${formattingRules}${sourceContext}${recentContext}${regenContext}

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
