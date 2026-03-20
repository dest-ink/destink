import { db } from '@/db/client';
import {
  channels,
  researchers,
  researcherChannels,
  researchRuns,
  voiceProfiles,
  drafts,
} from '@/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { runResearch } from './orchestrator';
import { callClaude } from '@/lib/ai/client';
import { generateDraftsForRun } from '@/lib/generation/batch';
import type {
  ResearchSource,
  TopicRecommendation,
  ResearchConfig,
  ResearchSourceConfig,
  VoiceProfile,
} from '@/db/schema';
import type { OnProgress } from './progress';

/**
 * Builds the prompt used to ask Claude to rank and filter research sources
 * into actionable content opportunities.
 * Pure function — no I/O.
 */
export function buildAnalysisPrompt(
  sources: ResearchSource[],
  personaPrompt: string,
  recentTitles: string[],
  guidance?: string,
): string {
  const sourcesText = sources
    .map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\nSummary: ${s.summary}`)
    .join('\n\n');

  const guidanceSection = guidance?.trim()
    ? `\n\nUSER GUIDANCE (prioritize this direction):\n${guidance.trim()}\n`
    : '';

  return `You are analyzing research for a content creator. Given their persona and these sources, rank the best content opportunities.

CRITICAL: Each topic MUST be meaningfully different from the others. Do NOT suggest multiple variations of the same theme. Prioritize VARIETY — different subjects, different angles, different industries or applications. If the persona has strong recurring beliefs, use those as TONE/STYLE guides, not as the topic itself.

PERSONA (use for voice/style, NOT as the topic):
${personaPrompt}
${guidanceSection}
RECENT POSTS (NEVER repeat these themes or similar angles):
${recentTitles.map(t => `- ${t}`).join('\n') || 'None'}

SOURCES:
${sourcesText}

Return a JSON array of up to 10 topic recommendations. Each topic MUST cover a DIFFERENT subject:
[{
  "title": "Suggested post title",
  "angle": "Specific angle this writer should take",
  "whyTimely": "Why this matters right now",
  "relevanceScore": 85,
  "contentType": "note",
  "sources": [{ "url": "...", "title": "...", "summary": "...", "source": "exa" }]
}]

Sort by relevanceScore descending. Return ONLY the JSON array.`;
}

/**
 * Build a ResearchConfig from a researcher's topics/keywords/sourceConfig,
 * enriched with runtime context for the brainstorm adapter.
 */
function buildResearchConfig(
  researcher: {
    topics: string[];
    keywords: string[];
    sourceConfig: ResearchSourceConfig;
    maxDraftsPerRun: number;
    shortFormPercent: number;
  },
  channelId: string,
  voiceProfile: VoiceProfile | null,
  recentTitles: string[],
): ResearchConfig {
  return {
    topics: researcher.topics,
    keywords: researcher.keywords,
    subreddits: researcher.sourceConfig.subreddits,
    substackFeeds: researcher.sourceConfig.substackFeeds,
    searchQueryTemplates: researcher.sourceConfig.searchQueryTemplates,
    excludedDomains: researcher.sourceConfig.excludedDomains,
    maxDraftsPerRun: researcher.maxDraftsPerRun,
    shortFormPercent: researcher.shortFormPercent,
    channelId,
    voiceProfile,
    recentTitles,
  };
}

/**
 * Run research for a standalone researcher entity.
 * Creates a research run per linked channel, using the researcher's config.
 * Emits progress events for SSE streaming.
 */
export async function runResearchForResearcher(
  researcherId: string,
  onProgress?: OnProgress,
  guidance?: string,
): Promise<void> {
  // Load the researcher
  const [researcher] = await db
    .select()
    .from(researchers)
    .where(eq(researchers.id, researcherId));
  if (!researcher) {
    throw new Error(`Researcher ${researcherId} not found`);
  }

  // Load linked channels
  const links = await db
    .select({ channelId: researcherChannels.channelId })
    .from(researcherChannels)
    .where(eq(researcherChannels.researcherId, researcherId));

  if (links.length === 0) {
    throw new Error(`Researcher "${researcher.name}" has no linked channels`);
  }

  const channelIds = links.map((l) => l.channelId);
  const linkedChannels = await db
    .select()
    .from(channels)
    .where(inArray(channels.id, channelIds));

  // For each linked channel, run the full pipeline
  for (const channel of linkedChannels) {
    // Get recent titles for this channel
    const recentDrafts = await db
      .select({ title: drafts.title })
      .from(drafts)
      .where(eq(drafts.channelId, channel.id))
      .orderBy(desc(drafts.createdAt))
      .limit(10);
    const recentTitles = recentDrafts.map((d) => d.title ?? '').filter(Boolean);

    // Get voice profile
    const [profile] = await db
      .select()
      .from(voiceProfiles)
      .where(eq(voiceProfiles.channelId, channel.id));
    const voiceProfile = (profile?.extractedProfile as VoiceProfile | null) ?? null;

    // Build config from researcher + channel context
    const config = buildResearchConfig(
      researcher,
      channel.id,
      voiceProfile,
      recentTitles,
    );

    // Run all adapters with progress
    const allSources = await runResearch(config, undefined, onProgress);

    // AI analysis: rank and filter
    const analysisPrompt = buildAnalysisPrompt(
      allSources,
      channel.personaPrompt ?? '',
      recentTitles,
      guidance,
    );
    const raw = await callClaude({
      model: 'claude-haiku-4-5-20251001',
      system: 'You are a content strategist. Return only valid JSON.',
      prompt: analysisPrompt,
      maxTokens: 8192,
      audit: { operation: 'topic_ranking', channelId: channel.id },
    });

    let topics: TopicRecommendation[];
    try {
      topics = JSON.parse(raw) as TopicRecommendation[];
    } catch {
      // Try to recover truncated JSON arrays by closing the last complete object
      const repaired = repairTruncatedJsonArray(raw);
      if (repaired) {
        topics = repaired as TopicRecommendation[];
      } else {
        onProgress?.({ type: 'run-error', error: `Claude returned invalid JSON: ${raw.slice(0, 200)}` });
        throw new Error(`[runResearchForResearcher] Claude returned invalid JSON: ${raw.slice(0, 200)}`);
      }
    }

    onProgress?.({ type: 'topic-ranking', topicCount: topics.length });

    // Persist the research run
    const [run] = await db
      .insert(researchRuns)
      .values({
        channelId: channel.id,
        researcherId,
        sourcesSearched: allSources,
        topicsFound: topics,
        aiModel: 'claude-haiku-4-5-20251001',
        tokensUsed: 0,
      })
      .returning();

    onProgress?.({
      type: 'run-complete',
      runId: run.id,
      topicCount: topics.length,
      sourceCount: allSources.length,
    });

    console.log(
      `[research] Researcher ${researcherId} → channel ${channel.id}: ${topics.length} topics, run ${run.id}`,
    );

    // Auto-draft: generate drafts if enabled on this researcher
    if (researcher.autoDraft) {
      try {
        const runTopics = run.topicsFound as TopicRecommendation[] ?? [];
        await generateDraftsForRun(
          run.id,
          channel.id,
          runTopics,
          researcher.maxDraftsPerRun,
          researcher.shortFormPercent,
          onProgress,
        );
        // generateDraftsForRun already emits drafts-done via onProgress
      } catch (err) {
        // Draft generation failures do NOT affect research run status
        onProgress?.({
          type: 'run-error',
          error: `Draft generation failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }
}

/**
 * Full research pipeline for a channel (legacy — used by CronJob).
 * 1. Loads channel + recent drafts + voice profile from DB
 * 2. Runs all registered adapters in parallel via runResearch()
 * 3. Asks Claude to rank and filter into topic recommendations
 * 4. Stores the research run in the DB
 */
export async function runResearchForChannel(channelId: string): Promise<void> {
  const [channel] = await db.select().from(channels).where(eq(channels.id, channelId));
  if (!channel || !channel.researchConfig) {
    throw new Error(`Channel ${channelId} not found or missing research config`);
  }

  const config = channel.researchConfig as ResearchConfig;

  // Fetch recent published post titles to avoid repeating themes
  const recentDrafts = await db
    .select({ title: drafts.title })
    .from(drafts)
    .where(eq(drafts.channelId, channelId))
    .orderBy(desc(drafts.createdAt))
    .limit(10);
  const recentTitles = recentDrafts.map(d => d.title ?? '').filter(Boolean);

  // Get voice profile if available
  const [profile] = await db
    .select()
    .from(voiceProfiles)
    .where(eq(voiceProfiles.channelId, channelId));
  const voiceProfile = (profile?.extractedProfile as VoiceProfile | null) ?? null;

  // Build extended config with brainstorm context fields so the brainstorm
  // adapter has the data it needs alongside the base research config.
  const extendedConfig: ResearchConfig & {
    channelId?: string;
    voiceProfile?: VoiceProfile | null;
    recentTitles?: string[];
  } = {
    ...config,
    channelId,
    voiceProfile,
    recentTitles,
  };

  // Fan out to ALL registered adapters (Exa, Reddit, Substack, brainstorm, etc.)
  const allSources = await runResearch(extendedConfig);

  // AI analysis: rank and filter sources into content opportunities
  const analysisPrompt = buildAnalysisPrompt(allSources, channel.personaPrompt ?? '', recentTitles);
  const raw = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    system: 'You are a content strategist. Return only valid JSON.',
    prompt: analysisPrompt,
    maxTokens: 8192,
    audit: { operation: 'topic_ranking', channelId },
  });

  let topics: TopicRecommendation[];
  try {
    topics = JSON.parse(raw) as TopicRecommendation[];
  } catch {
    const repaired = repairTruncatedJsonArray(raw);
    if (repaired) {
      topics = repaired as TopicRecommendation[];
    } else {
      throw new Error(`[runResearchForChannel] Claude returned invalid JSON: ${raw.slice(0, 200)}`);
    }
  }

  // Persist the research run
  const [run] = await db
    .insert(researchRuns)
    .values({
      channelId,
      sourcesSearched: allSources,
      topicsFound: topics,
      aiModel: 'claude-haiku-4-5-20251001',
      tokensUsed: 0, // actual token cost captured via ai_audit_log
    })
    .returning();

  console.log(`[research] Channel ${channelId}: found ${topics.length} topics, run ${run.id}`);
}

/**
 * Attempt to recover a truncated JSON array by finding the last complete object.
 * Returns the parsed array or null if recovery fails.
 */
function repairTruncatedJsonArray(raw: string): unknown[] | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('[')) return null;

  // Walk backwards to find the last complete object ending with `}`
  let lastBrace = trimmed.lastIndexOf('}');
  while (lastBrace > 0) {
    const candidate = trimmed.slice(0, lastBrace + 1) + ']';
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.warn(`[research] Repaired truncated JSON: kept ${parsed.length} items`);
        return parsed;
      }
    } catch {
      // Try the next `}` further back
    }
    lastBrace = trimmed.lastIndexOf('}', lastBrace - 1);
  }

  return null;
}
