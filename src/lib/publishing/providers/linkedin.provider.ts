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
    {
      key: 'accessToken', label: 'Access Token', type: 'secret', required: true,
      helpDetail: {
        title: 'How to get a LinkedIn access token',
        steps: [
          'Go to linkedin.com/developers and sign in.',
          'Click "Create App" (or select an existing app).',
          'Under the "Auth" tab, you\'ll find your Client ID and Client Secret.',
          'Use the OAuth 2.0 flow or the Developer Portal\'s token generator to create an access token with "w_member_social" scope.',
          'Copy the access token and paste it here.',
          'Your Person URN will be fetched automatically from the LinkedIn API.',
        ],
      },
    },
  ],
  oauth: {
    authPath: '/api/linkedin/auth',
    statusPath: '/api/linkedin/status',
    buttonLabel: 'Connect with LinkedIn',
    helpText: "You'll be redirected to LinkedIn to authorize access.",
    notConfiguredMessage: 'LinkedIn OAuth is not configured — one-click login is unavailable.',
    setupGuide: {
      title: 'How to set up LinkedIn OAuth',
      steps: [
        'Go to [linkedin.com/developers](https://www.linkedin.com/developers/apps) and sign in with your LinkedIn account.',
        'Click "Create App". Fill in the app name (e.g. "Destink"), your company page, and a logo.',
        'Once created, go to the "Auth" tab. Copy the Client ID and Client Secret.',
        'Go to "OAuth 2.0 settings" on the same page and add your redirect URL: `{NEXT_PUBLIC_APP_URL}/api/linkedin/callback`',
        'Go to the "Products" tab and request access to "Share on LinkedIn".',
        'Add these two environment variables to your `.env` file:\n`LINKEDIN_CLIENT_ID=your_client_id`\n`LINKEDIN_CLIENT_SECRET=your_client_secret`',
        'Restart the Destink server. The "Connect with LinkedIn" button will appear automatically.',
      ],
    },
  },
  publish: (draft, channel) => publishToLinkedIn(draft, channel),
  formatDraft: (draft, _channel) => formatForLinkedIn(draft),
  formattingInstructions: () => FORMATTING_RULES,
};

export default linkedInProvider;
