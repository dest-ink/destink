import type { ResearchAdapter } from '@/lib/providers/types';
import { PROVIDER_API_VERSION } from '@/lib/providers/types';
import { searchExa } from '../exa';

const exaAdapter: ResearchAdapter = {
  id: 'exa',
  name: 'exa',
  displayName: 'Exa Search',
  description: 'AI-powered web search for relevant content',
  apiVersion: PROVIDER_API_VERSION,
  search: (config) => searchExa(config),
};

export default exaAdapter;
