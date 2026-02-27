import { NextRequest, NextResponse } from 'next/server';
import { runResearchForChannel } from '@/lib/research/engine';

export async function POST(req: NextRequest) {
  let channelId: string;
  try {
    const body = await req.json() as { channelId?: unknown };
    if (!body.channelId || typeof body.channelId !== 'string') {
      return NextResponse.json({ error: 'channelId is required' }, { status: 400 });
    }
    channelId = body.channelId;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Fire and forget — respond immediately, run research in the background
  runResearchForChannel(channelId).catch(err =>
    console.error(`[api/research] runResearchForChannel failed for ${channelId}:`, err)
  );

  return NextResponse.json({ status: 'started', channelId });
}
