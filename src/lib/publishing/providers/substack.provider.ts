import type { PublisherProvider } from '@/lib/providers/types';
import { PROVIDER_API_VERSION } from '@/lib/providers/types';
import { publishToSubstack, formatForSubstack } from '../substack';

const substackProvider: PublisherProvider = {
  name: 'substack',
  platform: 'substack',
  displayName: 'Substack',
  description: 'Publish notes to your Substack publication',
  apiVersion: PROVIDER_API_VERSION,
  configSchema: [
    { key: 'publicationUrl', label: 'Publication URL', type: 'url', required: true },
    { key: 'handle', label: 'Substack Handle', type: 'string', required: true },
    { key: 'substackSid', label: 'substack.sid Cookie', type: 'secret', required: true },
    { key: 'substackLli', label: 'substack.lli Cookie', type: 'secret', required: true },
  ],
  publish: (draft, channel) => publishToSubstack(draft, channel),
  formatDraft: (draft, _channel) => formatForSubstack(draft),
};

export default substackProvider;
