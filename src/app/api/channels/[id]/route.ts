import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { channels, aiAuditLog } from '@/db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { auth } from '@/auth';
import { apiError } from '@/lib/errors';
import { getUserId } from '@/lib/auth-utils';

export const GET = auth(function GET(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const userId = await getUserId(req.auth);
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const { id } = await (ctx?.params as Promise<{ id: string }>);
      const [channel] = await db.select().from(channels).where(and(eq(channels.id, id), eq(channels.userId, userId)));
      if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const [costResult] = await db
        .select({
          totalCost: sql<string>`coalesce(sum(${aiAuditLog.costUsd}), '0')`,
          totalPromptTokens: sql<number>`coalesce(sum(${aiAuditLog.promptTokens}), 0)`,
          totalCompletionTokens: sql<number>`coalesce(sum(${aiAuditLog.completionTokens}), 0)`,
          operationCount: sql<number>`count(*)`,
        })
        .from(aiAuditLog)
        .where(eq(aiAuditLog.channelId, id));

      return NextResponse.json({
        ...channel,
        costSummary: {
          totalCostUsd: parseFloat(costResult.totalCost),
          totalPromptTokens: Number(costResult.totalPromptTokens),
          totalCompletionTokens: Number(costResult.totalCompletionTokens),
          operationCount: Number(costResult.operationCount),
        },
      });
    } catch (err) {
      const { message, status } = apiError('load channel details', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});

export const PATCH = auth(function PATCH(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const userId = await getUserId(req.auth);
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const { id } = await (ctx?.params as Promise<{ id: string }>);
      const body = await req.json();
      // Build partial update — only include fields explicitly present in the request body.
      // Credentials are never updatable here; they have their own auth routes.
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if ('name' in body) updates.name = body.name;
      if ('researchConfig' in body) updates.researchConfig = body.researchConfig;
      if ('scheduleConfig' in body) updates.scheduleConfig = body.scheduleConfig;
      if ('personaPrompt' in body) updates.personaPrompt = body.personaPrompt;

      const [updated] = await db.update(channels)
        .set(updates)
        .where(and(eq(channels.id, id), eq(channels.userId, userId)))
        .returning();
      if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(updated);
    } catch (err) {
      const { message, status } = apiError('update channel', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});

export const DELETE = auth(function DELETE(_req, ctx) {
  if (!_req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const userId = await getUserId(_req.auth);
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const { id } = await (ctx?.params as Promise<{ id: string }>);
      await db.delete(channels).where(and(eq(channels.id, id), eq(channels.userId, userId)));
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      const { message, status } = apiError('delete channel', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
