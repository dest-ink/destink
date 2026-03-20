import { db } from '@/db/client';
import { researchers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/auth';
import { initRegistries } from '@/lib/bootstrap';
import { runResearchForResearcher } from '@/lib/research/engine';
import type { ResearchProgressEvent } from '@/lib/research/progress';
import { NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth-utils';

export const POST = auth(function POST(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    const userId = await getUserId(req.auth);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await (ctx?.params as Promise<{ id: string }>);

    // Verify researcher exists and belongs to user
    const [researcher] = await db
      .select({ id: researchers.id })
      .from(researchers)
      .where(and(eq(researchers.id, id), eq(researchers.userId, userId)));
    if (!researcher) {
      return NextResponse.json({ error: 'Researcher not found' }, { status: 404 });
    }

    // Ensure adapters are initialized
    await initRegistries();

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        function send(event: ResearchProgressEvent) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }

        runResearchForResearcher(id, send)
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
