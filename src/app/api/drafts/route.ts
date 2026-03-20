import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { drafts, channels } from '@/db/schema';
import { and, eq, desc, inArray } from 'drizzle-orm';
import { generateDraft } from '@/lib/generation/generator';
import { randomUUID } from 'crypto';
import type { ResearchSource } from '@/db/schema';
import { auth } from '@/auth';
import { apiError } from '@/lib/errors';
import { getUserId } from '@/lib/auth-utils';

export const GET = auth(function GET(req) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    const userId = await getUserId(req.auth);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channelId');
    const statusParam = searchParams.get('status') as typeof drafts.$inferSelect['status'] | null;

    try {
      // Get all channel IDs owned by this user for filtering
      const userChannels = await db.select({ id: channels.id }).from(channels).where(eq(channels.userId, userId));
      const userChannelIds = userChannels.map(c => c.id);

      // Build conditions — both channelId and status can be applied simultaneously
      const conditions = [];
      if (channelId) {
        // Ensure the requested channelId belongs to this user
        if (!userChannelIds.includes(channelId)) {
          return NextResponse.json([], { status: 200 });
        }
        conditions.push(eq(drafts.channelId, channelId));
      } else if (userChannelIds.length > 0) {
        conditions.push(inArray(drafts.channelId, userChannelIds));
      } else {
        return NextResponse.json([], { status: 200 });
      }
      if (statusParam) conditions.push(eq(drafts.status, statusParam));

      const rows = await db
        .select()
        .from(drafts)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(drafts.createdAt));

      return NextResponse.json(rows);
    } catch (err) {
      console.error('[GET /api/drafts]', err);
      const { message, status } = apiError('load drafts', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});

export const POST = auth(function POST(req) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    let body: {
      channelId?: string;
      contentType?: 'note' | 'article';
      topicTitle?: string;
      topicAngle?: string;
      sources?: ResearchSource[];
      regenerationNote?: string;
    };

    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { channelId, contentType, topicTitle, topicAngle, sources, regenerationNote } = body;

    if (!channelId || !contentType || !topicTitle || !topicAngle) {
      return NextResponse.json(
        { error: 'channelId, contentType, topicTitle, and topicAngle are required' },
        { status: 400 }
      );
    }

    try {
      const userId = await getUserId(req.auth);
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const [channel] = await db.select().from(channels).where(and(eq(channels.id, channelId), eq(channels.userId, userId)));
      if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });

      const recentDrafts = await db
        .select({ title: drafts.title })
        .from(drafts)
        .where(eq(drafts.channelId, channelId))
        .orderBy(desc(drafts.createdAt))
        .limit(10);

      const draftId = randomUUID();
      const generated = await generateDraft(
        {
          contentType,
          personaPrompt: channel.personaPrompt ?? '',
          topicTitle,
          topicAngle,
          sources: sources ?? [],
          recentTitles: recentDrafts.map(d => d.title ?? '').filter(Boolean),
          regenerationNote,
        },
        channelId,
        draftId
      );

      const [draft] = await db
        .insert(drafts)
        .values({
          id: draftId,
          channelId,
          contentType,
          title: generated.headlineOptions[0] ?? null,
          headlineOptions: generated.headlineOptions,
          hook: generated.hook,
          body: generated.body,
          cta: generated.cta,
          voiceConfidence: generated.voiceConfidence,
          researchSources: sources ?? [],
          aiModel: 'claude-sonnet-4-6',
          status: 'pending_review',
          regenerationNote: regenerationNote ?? null,
        })
        .returning();

      return NextResponse.json(draft, { status: 201 });
    } catch (err) {
      console.error('[POST /api/drafts]', err);
      const { message, status } = apiError('generate draft', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
