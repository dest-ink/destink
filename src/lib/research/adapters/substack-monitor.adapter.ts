import type { ResearchAdapter } from '@/lib/providers/types';
import { PROVIDER_API_VERSION } from '@/lib/providers/types';
import { monitorSubstackFeeds } from '../substack-monitor';

const substackMonitorAdapter: ResearchAdapter = {
  id: 'substack-monitor',
  name: 'substack-monitor',
  displayName: 'Substack Monitor',
  description: 'Monitor Substack publication feeds for relevant content',
  apiVersion: PROVIDER_API_VERSION,
  search: (config) => monitorSubstackFeeds(config),
};

export default substackMonitorAdapter;
