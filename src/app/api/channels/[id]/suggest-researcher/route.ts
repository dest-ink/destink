import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { channels, voiceProfiles } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/auth';
import { apiError } from '@/lib/errors';
import { getUserId } from '@/lib/auth-utils';

/**
 * GET /api/channels/:id/suggest-researcher
 * Returns a suggested prompt for creating a researcher based on the channel's
 * voice profile, platform, and name.
 */
export const GET = auth(function GET(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const userId = await getUserId(req.auth);
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const { id } = await (ctx?.params as Promise<{ id: string }>);

      const [channel] = await db.select().from(channels).where(and(eq(channels.id, id), eq(channels.userId, userId)));
      if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });

      // Get voice profile info
      const profiles = await db.select().from(voiceProfiles).where(eq(voiceProfiles.channelId, id));
      const voiceInfo = channel.personaPrompt
        ? channel.personaPrompt.slice(0, 500)
        : profiles.length > 0 && profiles[0].rawInput
          ? profiles[0].rawInput.slice(0, 500)
          : null;

      // Build a suggested prompt based on channel info
      const parts: string[] = [];
      parts.push(`I publish on ${channel.platform === 'linkedin' ? 'LinkedIn' : 'Substack'}`);

      if (channel.name) {
        parts.push(`for my channel "${channel.name}"`);
      }

      if (voiceInfo) {
        // Extract key details from the voice profile
        const lines = voiceInfo.split('\n').filter(l => l.trim());
        const styleLines = lines.filter(l =>
          l.toLowerCase().includes('style') ||
          l.toLowerCase().includes('tone') ||
          l.toLowerCase().includes('reader') ||
          l.toLowerCase().includes('admire')
        );
        if (styleLines.length > 0) {
          parts.push('. ' + styleLines.slice(0, 3).join('. '));
        }
      }

      const suggestedPrompt = parts.join(' ').replace(/\.\s+\./g, '.').trim();

      return NextResponse.json({
        channelName: channel.name,
        platform: channel.platform,
        hasVoice: !!channel.personaPrompt,
        suggestedPrompt,
      });
    } catch (err) {
      const { message, status } = apiError('suggest researcher', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
