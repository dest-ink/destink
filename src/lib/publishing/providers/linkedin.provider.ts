import type { PublisherProvider } from '@/lib/providers/types';
import { PROVIDER_API_VERSION } from '@/lib/providers/types';
import { publishToLinkedIn, formatForLinkedIn } from '../linkedin';

const linkedInProvider: PublisherProvider = {
  name: 'linkedin',
  platform: 'linkedin',
  displayName: 'LinkedIn',
  description: 'Publish posts to your LinkedIn profile',
  apiVersion: PROVIDER_API_VERSION,
  configSchema: [
    { key: 'accessToken', label: 'Access Token', type: 'secret', required: true },
    { key: 'personUrn', label: 'Person URN', type: 'string', required: true },
  ],
  publish: (draft, channel) => publishToLinkedIn(draft, channel),
  formatDraft: (draft, _channel) => formatForLinkedIn(draft),
};

export default linkedInProvider;
