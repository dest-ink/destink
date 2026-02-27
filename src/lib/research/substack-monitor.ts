import type { ResearchConfig, ResearchSource } from '@/db/schema';
import Parser from 'rss-parser';

const parser = new Parser();

/**
 * Normalises feed entries from substackFeeds config:
 * - Full URLs (starting with http/https) → passed through as-is
 * - Bare subdomains (e.g. "lenny.substack.com") → prefixed with https:// and /feed appended
 * Pure function — no I/O.
 */
export function buildSubstackFeedUrls(config: ResearchConfig): string[] {
  return (config.substackFeeds ?? [])
    .slice(0, 10)
    .map(feed => {
      if (feed.startsWith('http://') || feed.startsWith('https://')) {
        return feed;
      }
      // Bare subdomain or domain — trim trailing slashes, then add scheme and /feed path
      const trimmed = feed.replace(/\/+$/, '');
      const base = trimmed.endsWith('/feed') ? trimmed : `${trimmed}/feed`;
      return `https://${base}`;
    });
}

/**
 * Fetches and parses RSS feeds from configured Substack publications.
 * Each feed failure is caught individually so one bad URL doesn't abort the run.
 */
export async function monitorSubstackFeeds(config: ResearchConfig): Promise<ResearchSource[]> {
  const urls = buildSubstackFeedUrls(config);
  const sources: ResearchSource[] = [];

  for (const url of urls) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of (feed.items ?? []).slice(0, 5)) {
        sources.push({
          url: item.link ?? url,
          title: item.title ?? '',
          summary: item.contentSnippet?.slice(0, 500) ?? item.summary?.slice(0, 500) ?? '',
          source: 'substack',
        });
      }
    } catch (err) {
      console.error(`[monitorSubstackFeeds] failed parsing ${url}:`, err);
      // continue to next feed
    }
  }

  return sources;
}
