import type { PublisherProvider } from '@/lib/providers/types';
import { PROVIDER_API_VERSION } from '@/lib/providers/types';
import { publishToSubstack, formatForSubstack } from '../substack';

const FORMATTING_RULES: Record<string, string> = {
  note: `FORMATTING RULES (Substack):
- Use markdown formatting: **bold**, *italic*, ~~strikethrough~~
- Use bullet lists with - for enumeration
- Use numbered lists with 1. 2. 3. for ordered items
- Use > for blockquotes or pull quotes
- Start with a strong hook line, then a line break
- Keep paragraphs to 2-3 sentences max for readability
- End with a clear CTA or question to drive engagement`,
  article: `FORMATTING RULES (Substack article):
- Use markdown formatting: **bold**, *italic*, ## headings, > blockquotes
- Use ## for section headings (not #, which is the title)
- Use --- for section breaks
- Use bullet lists with - for enumeration
- Use > for pull quotes or key insights
- Use **bold** for key terms and emphasis
- Structure with clear sections: intro, main argument sections, conclusion
- Include transition sentences between sections`,
};

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
  formattingInstructions: (contentType) => FORMATTING_RULES[contentType] ?? null,
};

export default substackProvider;
