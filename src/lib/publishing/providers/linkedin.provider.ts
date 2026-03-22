import type { PublisherProvider } from '@/lib/providers/types';
import { PROVIDER_API_VERSION } from '@/lib/providers/types';
import { publishToLinkedIn, formatForLinkedIn } from '../linkedin';

const FORMATTING_RULES = `FORMATTING RULES (LinkedIn):
- Use plain text only — NO markdown, NO HTML, NO hashtags at the start
- Use line breaks for paragraph separation (\\n\\n)
- Use unicode characters for emphasis: bold text can use strategic ALL CAPS for 1-2 key words
- Use "→" arrows, "•" bullets, and "—" em dashes for structure
- Start with a strong hook line, then a line break
- Keep paragraphs to 2-3 sentences max for mobile readability
- End with a clear CTA or question to drive engagement`;

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
  formattingInstructions: () => FORMATTING_RULES,
};

export default linkedInProvider;
