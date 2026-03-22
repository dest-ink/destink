import { db } from '@/db/client';
import { researchers, researchRuns } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { generateDraftsForRun } from '@/lib/generation/batch';
import type { TopicRecommendation } from '@/db/schema';
import type { ResearchProgressEvent } from '@/lib/research/progress';
import { getUserId } from '@/lib/auth-utils';

export const POST = auth(function POST(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    const userId = await getUserId(req.auth);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, runId } = await (ctx?.params as Promise<{ id: string; runId: string }>);

    // Load researcher (need full record for maxDraftsPerRun and shortFormPercent), verifying ownership
    const [researcher] = await db
      .select()
      .from(researchers)
      .where(and(eq(researchers.id, id), eq(researchers.userId, userId)));
    if (!researcher) {
      return NextResponse.json({ error: 'Researcher not found' }, { status: 404 });
    }

    // Load run and verify it belongs to this researcher
    const [run] = await db
      .select()
      .from(researchRuns)
      .where(and(eq(researchRuns.id, runId), eq(researchRuns.researcherId, id)));
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    // Guard: if drafts already generated for this run, return 409
    const existingDrafts = run.draftsGenerated as string[] | null;
    if (existingDrafts && existingDrafts.length > 0) {
      return NextResponse.json(
        { error: 'Drafts already generated for this run' },
        { status: 409 },
      );
    }

    // Parse optional guidance from request body
    let guidance: string | undefined;
    try {
      const body = await req.json();
      if (body.guidance && typeof body.guidance === 'string') {
        guidance = body.guidance.trim() || undefined;
      }
    } catch {
      // No body or invalid JSON — guidance is optional
    }

    const topics = (run.topicsFound as TopicRecommendation[]) ?? [];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        function send(event: ResearchProgressEvent) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }

        generateDraftsForRun(
          run.id,
          run.channelId,
          topics,
          researcher.maxDraftsPerRun,
          researcher.shortFormPercent,
          send,
          guidance,
        )
          .then(() => {
            controller.close();
          })
          .catch((err) => {
            send({
              type: 'run-error',
              error: err instanceof Error ? err.message : String(err),
            });
            controller.close();
          });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  })();
});
