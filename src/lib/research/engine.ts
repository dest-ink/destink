import { db } from '@/db/client';
import { channels, researchRuns, voiceProfiles, drafts } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { searchExa } from './exa';
import { searchReddit } from './reddit';
import { monitorSubstackFeeds } from './substack-monitor';
import { brainstormTopics } from './brainstorm';
import { callClaude } from '@/lib/ai/client';
import type { ResearchSource, TopicRecommendation, ResearchConfig, VoiceProfile } from '@/db/schema';

/**
 * Builds the prompt used to ask Claude to rank and filter research sources
 * into actionable content opportunities.
 * Pure function — no I/O.
 */
export function buildAnalysisPrompt(
  sources: ResearchSource[],
  personaPrompt: string,
  recentTitles: string[]
): string {
  const sourcesText = sources
    .map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\nSummary: ${s.summary}`)
    .join('\n\n');

  return `You are analyzing research for a content creator. Given their persona and these sources, rank the best content opportunities.

PERSONA:
${personaPrompt}

RECENT POSTS (avoid repeating themes):
${recentTitles.map(t => `- ${t}`).join('\n') || 'None'}

SOURCES:
${sourcesText}

Return a JSON array of up to 10 topic recommendations:
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
 * Full research pipeline for a channel:
 * 1. Loads channel + recent drafts + voice profile from DB
 * 2. Runs all four signal sources in parallel (Exa, Reddit, Substack, brainstorm)
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

  // Gather all signals in parallel — per-source failures are handled inside each adapter
  const [exaSources, redditSources, substackSources, brainstormSources] = await Promise.all([
    searchExa(config),
    searchReddit(config),
    monitorSubstackFeeds(config),
    brainstormTopics(config, voiceProfile, recentTitles, channelId),
  ]);

  const allSources = [...exaSources, ...redditSources, ...substackSources, ...brainstormSources];

  // AI analysis: rank and filter sources into content opportunities
  const analysisPrompt = buildAnalysisPrompt(allSources, channel.personaPrompt ?? '', recentTitles);
  const raw = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    system: 'You are a content strategist. Return only valid JSON.',
    prompt: analysisPrompt,
    maxTokens: 2048,
    audit: { operation: 'topic_ranking', channelId },
  });

  let topics: TopicRecommendation[];
  try {
    topics = JSON.parse(raw) as TopicRecommendation[];
  } catch {
    throw new Error(`[runResearchForChannel] Claude returned invalid JSON: ${raw.slice(0, 200)}`);
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
