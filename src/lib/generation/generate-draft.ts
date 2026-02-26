import { db } from '@/db/client';
import { drafts } from '@/db/schema';
import type { ResearchSource } from '@/db/schema';
import { callClaude } from '@/lib/ai/client';

const MODEL = 'claude-haiku-4-5-20251001' as const;

interface DraftJson {
  title?: string | null;
  headlineOptions?: string[];
  hook: string;
  body: string;
  cta?: string;
  voiceConfidence?: number;
}

function buildPrompt(params: {
  personaPrompt: string;
  sources: ResearchSource[];
  contentType: 'note' | 'article';
  topicHint?: string;
}): string {
  const { personaPrompt, sources, contentType, topicHint } = params;

  const limitedSources = sources.slice(0, 5);
  const sourcesText = limitedSources
    .map((s, i) => `Source ${i + 1}: ${s.title}\nSummary: ${s.summary}`)
    .join('\n\n');

  const contentSpec =
    contentType === 'note'
      ? 'a short LinkedIn-style post (≤300 words). Set "title" to null.'
      : 'a longer Substack-style article (600-1200 words) with a clear title.';

  const topicLine = topicHint ? `\nFocus topic: ${topicHint}` : '';

  return `You are a ghostwriter. Write content in the author's voice as described below.

VOICE GUIDANCE:
${personaPrompt}

RESEARCH SOURCES:
${sourcesText}

TASK:
Write ${contentSpec}${topicLine}

Return ONLY valid JSON matching this exact shape (no explanation, no markdown):
{
  "title": "string or null (null for short notes)",
  "headlineOptions": ["alt headline 1", "alt headline 2", "alt headline 3"],
  "hook": "opening line or paragraph",
  "body": "main content",
  "cta": "call to action",
  "voiceConfidence": 85
}

"voiceConfidence" is your self-assessment (0-100) of how well the draft matches the persona voice.`;
}

export async function generateDraft(params: {
  channelId: string;
  personaPrompt: string;
  sources: ResearchSource[];
  contentType: 'note' | 'article';
  topicHint?: string;
}): Promise<string> {
  const { channelId, personaPrompt, sources, contentType, topicHint } = params;

  const prompt = buildPrompt({ personaPrompt, sources, contentType, topicHint });

  // callClaude handles Anthropic SDK invocation and audit logging internally
  const raw = await callClaude({
    model: MODEL,
    system: 'You are a ghostwriter. Return only valid JSON, no explanation or markdown.',
    prompt,
    maxTokens: 2000,
    audit: {
      operation: 'draft_generation',
      channelId,
      entityType: 'draft',
    },
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Draft generation returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  const draft = parsed as DraftJson;

  if (
    typeof draft !== 'object' ||
    draft === null ||
    typeof draft.hook !== 'string' ||
    typeof draft.body !== 'string'
  ) {
    throw new Error(
      `Draft generation returned unexpected JSON shape (missing hook or body): ${raw.slice(0, 200)}`
    );
  }

  const [inserted] = await db
    .insert(drafts)
    .values({
      channelId,
      contentType,
      title: draft.title ?? null,
      headlineOptions: draft.headlineOptions ?? null,
      hook: draft.hook,
      body: draft.body,
      cta: draft.cta ?? null,
      voiceConfidence: typeof draft.voiceConfidence === 'number' ? draft.voiceConfidence : null,
      researchSources: sources.slice(0, 5),
      aiModel: MODEL,
      status: 'pending_review',
    })
    .returning();

  return inserted.id;
}
