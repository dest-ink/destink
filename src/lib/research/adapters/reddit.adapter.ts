import type { ResearchAdapter } from '@/lib/providers/types';
import { PROVIDER_API_VERSION } from '@/lib/providers/types';
import { searchReddit } from '../reddit';

const redditAdapter: ResearchAdapter = {
  id: 'reddit',
  name: 'reddit',
  displayName: 'Reddit',
  description: 'Monitor subreddit discussions for trending topics',
  apiVersion: PROVIDER_API_VERSION,
  search: (config) => searchReddit(config),
};

export default redditAdapter;
