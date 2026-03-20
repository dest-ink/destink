import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { automationSchedules, researchers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/auth';
import { apiError } from '@/lib/errors';
import { validate } from 'node-cron';
import { getNextRunAt } from '@/lib/cron-utils';
import { getUserId } from '@/lib/auth-utils';

export const PUT = auth(function PUT(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const userId = await getUserId(req.auth);
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const { id, scheduleId } = await (ctx?.params as Promise<{ id: string; scheduleId: string }>);

      // Verify researcher ownership
      const [researcher] = await db.select({ id: researchers.id }).from(researchers).where(and(eq(researchers.id, id), eq(researchers.userId, userId)));
      if (!researcher) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const body = await req.json();

      const updates: Record<string, unknown> = { updatedAt: new Date() };

      if ('name' in body) updates.name = body.name ?? null;
      if ('enabled' in body) updates.enabled = body.enabled;
      if ('autoDraft' in body) updates.autoDraft = body.autoDraft ?? null;
      if ('maxDraftsPerRun' in body) {
        const val = body.maxDraftsPerRun;
        if (val != null && (!Number.isInteger(val) || val <= 0)) {
          return NextResponse.json({ error: 'maxDraftsPerRun must be a positive integer' }, { status: 400 });
        }
        updates.maxDraftsPerRun = val ?? null;
      }

      if ('cronExpression' in body) {
        const cron: string = body.cronExpression;
        if (!cron || !validate(cron)) {
          return NextResponse.json({ error: 'Invalid cron expression' }, { status: 400 });
        }
        updates.cronExpression = cron;
        updates.nextRunAt = getNextRunAt(cron) ?? null;
      } else if ('enabled' in body && body.enabled === true) {
        // Re-enabled without changing cron — recompute nextRunAt from existing cron
        const [existing] = await db
          .select({ cronExpression: automationSchedules.cronExpression })
          .from(automationSchedules)
          .where(
            and(
              eq(automationSchedules.id, scheduleId),
              eq(automationSchedules.researcherId, id),
            ),
          );
        if (existing) {
          updates.nextRunAt = getNextRunAt(existing.cronExpression) ?? null;
        }
      }

      const [updated] = await db
        .update(automationSchedules)
        .set(updates)
        .where(
          and(
            eq(automationSchedules.id, scheduleId),
            eq(automationSchedules.researcherId, id),
          ),
        )
        .returning();

      if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(updated);
    } catch (err) {
      const { message, status } = apiError('update schedule', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});

export const DELETE = auth(function DELETE(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const userId = await getUserId(req.auth);
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const { id, scheduleId } = await (ctx?.params as Promise<{ id: string; scheduleId: string }>);

      // Verify researcher ownership
      const [researcher] = await db.select({ id: researchers.id }).from(researchers).where(and(eq(researchers.id, id), eq(researchers.userId, userId)));
      if (!researcher) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      await db
        .delete(automationSchedules)
        .where(
          and(
            eq(automationSchedules.id, scheduleId),
            eq(automationSchedules.researcherId, id),
          ),
        );
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      const { message, status } = apiError('delete schedule', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
