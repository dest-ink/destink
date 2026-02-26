import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { drafts, channels } from '@/db/schema';
import { and, eq, desc } from 'drizzle-orm';
import { generateDraft } from '@/lib/generation/generator';
import { randomUUID } from 'crypto';
import type { ResearchSource } from '@/db/schema';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get('channelId');
  const statusParam = searchParams.get('status') as typeof drafts.$inferSelect['status'] | null;

  try {
    // Build conditions — both channelId and status can be applied simultaneously
    const conditions = [];
    if (channelId) conditions.push(eq(drafts.channelId, channelId));
    if (statusParam) conditions.push(eq(drafts.status, statusParam));

    const rows = await db
      .select()
      .from(drafts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(drafts.createdAt));

    return NextResponse.json(rows);
  } catch (err) {
    console.error('[GET /api/drafts]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
    const [channel] = await db.select().from(channels).where(eq(channels.id, channelId));
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
