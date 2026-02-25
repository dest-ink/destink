import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { channels } from '@/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const rows = await db.select().from(channels).orderBy(desc(channels.createdAt));
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name || !body.platform) {
      return NextResponse.json({ error: 'name and platform are required' }, { status: 400 });
    }
    if (!['linkedin', 'substack'].includes(body.platform)) {
      return NextResponse.json({ error: 'platform must be linkedin or substack' }, { status: 400 });
    }
    const [channel] = await db.insert(channels).values({
      name: body.name,
      platform: body.platform,
      platformId: body.platformId ?? null,
      researchConfig: body.researchConfig ?? null,
      scheduleConfig: body.scheduleConfig ?? null,
    }).returning();
    return NextResponse.json(channel, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
