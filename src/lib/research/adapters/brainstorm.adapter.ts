import type { ResearchAdapter } from '@/lib/providers/types';
import { PROVIDER_API_VERSION } from '@/lib/providers/types';
import { brainstormTopics } from '../brainstorm';

const brainstormAdapter: ResearchAdapter = {
  id: 'brainstorm',
  name: 'brainstorm',
  displayName: 'AI Brainstorm',
  description: 'Generate topic ideas using AI based on research config and voice profile',
  apiVersion: PROVIDER_API_VERSION,
  search: (config) => {
    const { voiceProfile = null, recentTitles = [], channelId } = config;
    // Brainstorm requires channel context — return empty array if channelId is missing
    if (!channelId) {
      return Promise.resolve([]);
    }
    return brainstormTopics(config, voiceProfile ?? null, recentTitles, channelId);
  },
};

export default brainstormAdapter;
