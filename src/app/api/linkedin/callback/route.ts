import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { channels, researcherChannels } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { encrypt } from '@/lib/crypto';

/**
 * GET /api/linkedin/callback?code=...&state=...
 *
 * LinkedIn redirects here after the user authorizes. Exchanges the auth code
 * for an access token, fetches the person URN, encrypts credentials, and
 * saves them to the channel.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');

  // Decode state to get channelId
  let channelId: string | undefined;
  try {
    const decoded = JSON.parse(Buffer.from(stateParam ?? '', 'base64').toString('utf8'));
    channelId = decoded.channelId;
  } catch {
    // channelId stays undefined, handled below
  }

  if (!channelId) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/channels?error=linkedin_auth_failed`);
  }

  if (!code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/channels/${channelId}?error=linkedin_auth_failed`);
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const encKey = process.env.ENCRYPTION_KEY;

  if (!clientId || !clientSecret || !encKey) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/channels/${channelId}?error=linkedin_auth_failed`);
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/linkedin/callback`;

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text().catch(() => '');
      console.error('[linkedin-oauth] Token exchange failed:', tokenRes.status, errBody);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/channels/${channelId}?error=linkedin_token_failed`);
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      console.error('[linkedin-oauth] No access_token in response:', tokenData);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/channels/${channelId}?error=linkedin_token_missing`);
    }

    // Fetch person URN via /v2/userinfo (requires openid scope)
    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileRes.ok) {
      const errBody = await profileRes.text().catch(() => '');
      console.error('[linkedin-oauth] Profile fetch failed:', profileRes.status, errBody);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/channels/${channelId}?error=linkedin_profile_failed`);
    }

    const profile = (await profileRes.json()) as { sub?: string };
    if (!profile.sub) {
      console.error('[linkedin-oauth] No sub in profile response:', profile);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/channels/${channelId}?error=linkedin_profile_missing`);
    }

    const personUrn = `urn:li:person:${profile.sub}`;

    // Encrypt and save credentials
    const encrypted = encrypt(JSON.stringify({ accessToken, personUrn }), encKey);

    await db
      .update(channels)
      .set({ credentials: encrypted, updatedAt: new Date() })
      .where(eq(channels.id, channelId));

    // Find researcher linked to this channel (if any) for redirect
    const [link] = await db
      .select({ researcherId: researcherChannels.researcherId })
      .from(researcherChannels)
      .where(eq(researcherChannels.channelId, channelId))
      .limit(1);

    if (link?.researcherId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/pipelines/${link.researcherId}`);
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/channels/${channelId}`);
  } catch (err) {
    console.error('[linkedin-oauth] Unexpected error:', err);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/channels/${channelId}?error=linkedin_auth_failed`);
  }
}
