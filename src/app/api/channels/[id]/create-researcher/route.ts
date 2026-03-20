import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { channels, researchers, researcherChannels, automationSchedules } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/auth';
import { apiError } from '@/lib/errors';
import { parseOnboardingIntent } from '@/lib/onboarding/parse-intent';
import { getNextRunAt } from '@/lib/cron-utils';
import { getUserId } from '@/lib/auth-utils';

const FREQUENCY_TO_CRON: Record<string, string> = {
  twice_daily: '0 8,20 * * *',
  daily: '0 8 * * *',
  every_other_day: '0 8 */2 * *',
  weekly: '0 8 * * 1',
};

/**
 * POST /api/channels/:id/create-researcher
 * Uses AI to parse intent and creates a researcher linked to an EXISTING channel.
 * Does NOT create a new channel or modify voice/credentials.
 */
export const POST = auth(function POST(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const userId = await getUserId(req.auth);
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const { id: channelId } = await (ctx?.params as Promise<{ id: string }>);

      // Verify channel exists and belongs to user
      const [channel] = await db.select().from(channels).where(and(eq(channels.id, channelId), eq(channels.userId, userId)));
      if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });

      const body = await req.json();
      if (!body.input || typeof body.input !== 'string' || body.input.trim().length < 10) {
        return NextResponse.json(
          { error: 'Please describe what you want to research (at least a sentence).' },
          { status: 400 },
        );
      }

      // Parse intent with AI
      const intent = await parseOnboardingIntent(body.input.trim());

      const cronExpression = FREQUENCY_TO_CRON[intent.schedule.frequency] ?? FREQUENCY_TO_CRON.daily;
      const nextRunAt = getNextRunAt(cronExpression) ?? new Date();

      // Create researcher + link + schedule in transaction
      const result = await db.transaction(async (tx) => {
        const [researcher] = await tx.insert(researchers).values({
          userId,
          name: intent.researcher.name,
          topics: intent.researcher.topics,
          keywords: intent.researcher.keywords,
          sourceConfig: intent.researcher.sourceConfig,
          maxDraftsPerRun: 3,
          shortFormPercent: intent.researcher.shortFormPercent,
          autoDraft: true,
        }).returning();

        await tx.insert(researcherChannels).values({
          researcherId: researcher.id,
          channelId,
        });

        const [schedule] = await tx.insert(automationSchedules).values({
          researcherId: researcher.id,
          name: 'Auto-created schedule',
          cronExpression,
          enabled: true,
          nextRunAt,
          autoDraft: true,
        }).returning();

        return {
          researcherId: researcher.id,
          researcherName: researcher.name,
          scheduleId: schedule.id,
        };
      });

      return NextResponse.json(result, { status: 201 });
    } catch (err) {
      const { message, status } = apiError('create researcher', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
