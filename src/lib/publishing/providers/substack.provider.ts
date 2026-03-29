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
    { key: 'publicationUrl', label: 'Publication URL', type: 'url', required: true, helpText: 'e.g. https://yourname.substack.com' },
    { key: 'handle', label: 'Substack Handle', type: 'string', required: true, helpText: 'The subdomain part of your URL (e.g. "yourname")' },
    {
      key: 'substackSid', label: 'substack.sid Cookie', type: 'secret', required: true,
      helpDetail: {
        title: 'How to find your substack.sid cookie',
        steps: [
          'Open substack.com in your browser and make sure you\'re logged in.',
          'Open DevTools: press F12, or right-click anywhere and choose "Inspect".',
          'Click the "Application" tab at the top of DevTools (you may need to click ">>" to see it).',
          'In the left sidebar, expand "Cookies" and click on "https://substack.com".',
          'Find the row named "substack.sid" in the table.',
          'Double-click the value in the "Value" column to select it, then copy it.',
          'Paste the value here.',
        ],
      },
    },
    {
      key: 'substackLli', label: 'substack.lli Cookie', type: 'secret', required: true,
      helpDetail: {
        title: 'How to find your substack.lli cookie',
        steps: [
          'Follow the same steps as above — you should already have DevTools open to the Cookies panel.',
          'Find the row named "substack.lli" in the same table.',
          'Double-click the value to select it, then copy and paste it here.',
        ],
      },
    },
  ],
  publish: (draft, channel) => publishToSubstack(draft, channel),
  formatDraft: (draft, _channel) => formatForSubstack(draft),
  formattingInstructions: (contentType) => FORMATTING_RULES[contentType] ?? null,
};

export default substackProvider;
