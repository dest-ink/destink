import { NextResponse } from 'next/server';
import { auth } from '@/auth';

/**
 * GET /api/linkedin/auth?channelId=...
 *
 * Initiates the LinkedIn OAuth flow by redirecting the user to LinkedIn's
 * authorization page. Requires LINKEDIN_CLIENT_ID to be configured.
 */
export const GET = auth(function GET(req) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: 'LinkedIn OAuth is not configured. Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to your .env file.' },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get('channelId');
  if (!channelId) {
    return NextResponse.json({ error: 'channelId query parameter is required' }, { status: 400 });
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/linkedin/callback`;
  const state = Buffer.from(JSON.stringify({ channelId })).toString('base64');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid profile w_member_social',
    state,
  });

  return NextResponse.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`);
});
