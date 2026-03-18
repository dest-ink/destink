import type { ResearchConfig, ResearchSource } from '@/db/schema';

/**
 * Builds Reddit hot.json API URLs for each configured subreddit.
 * Pure function — no I/O.
 */
export function buildRedditUrls(config: ResearchConfig): string[] {
  return (config.subreddits ?? [])
    .slice(0, 5)
    .map(sub => {
      // Strip leading 'r/' if present so we don't double it in the URL
      const name = sub.startsWith('r/') ? sub.slice(2) : sub;
      return `https://www.reddit.com/r/${name}/hot.json?limit=10`;
    });
}

/**
 * Fetches the top 10 hot posts from each configured subreddit.
 * Each subreddit failure is caught individually and logged — one bad subreddit
 * does not abort the whole run.
 * No API key required (public Reddit JSON API).
 */
export async function searchReddit(config: ResearchConfig): Promise<ResearchSource[]> {
  const urls = buildRedditUrls(config);
  const sources: ResearchSource[] = [];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          // Reddit 429s without a meaningful User-Agent
          'User-Agent': 'destink-research-bot/0.1',
        },
      });
      if (!res.ok) {
        console.warn(`[searchReddit] ${url} returned ${res.status}`);
        continue;
      }
      const data = await res.json() as {
        data?: {
          children?: Array<{
            data: {
              title: string;
              url: string;
              selftext?: string;
              permalink: string;
              score: number;
            };
          }>;
        };
      };
      for (const child of data.data?.children ?? []) {
        const post = child.data;
        sources.push({
          url: `https://reddit.com${post.permalink}`,
          title: post.title,
          summary: (post.selftext ?? '').slice(0, 500) || `Reddit post: ${post.title}`,
          source: 'reddit',
        });
      }
    } catch (err) {
      console.error(`[searchReddit] failed fetching ${url}:`, err);
      // continue to next subreddit
    }
  }

  return sources;
}
