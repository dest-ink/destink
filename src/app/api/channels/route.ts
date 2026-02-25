import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { channels } from '@/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  const rows = await db.select().from(channels).orderBy(desc(channels.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const [channel] = await db.insert(channels).values({
    name: body.name,
    platform: body.platform,
    platformId: body.platformId ?? null,
    researchConfig: body.researchConfig ?? null,
    scheduleConfig: body.scheduleConfig ?? null,
  }).returning();
  return NextResponse.json(channel, { status: 201 });
}
