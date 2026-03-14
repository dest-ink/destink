import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { automationSchedules } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { auth } from '@/auth';
import { apiError } from '@/lib/errors';
import { validate } from 'node-cron';
import { getNextRunAt } from '@/lib/cron-utils';

export const GET = auth(function GET(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const { id } = await (ctx?.params as Promise<{ id: string }>);
      const schedules = await db
        .select()
        .from(automationSchedules)
        .where(eq(automationSchedules.researcherId, id))
        .orderBy(asc(automationSchedules.createdAt));
      return NextResponse.json(schedules);
    } catch (err) {
      const { message, status } = apiError('load schedules', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});

export const POST = auth(function POST(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const { id } = await (ctx?.params as Promise<{ id: string }>);
      const body = await req.json();

      const { cronExpression, name, enabled, autoDraft, maxDraftsPerRun } = body as {
        cronExpression: string;
        name?: string;
        enabled?: boolean;
        autoDraft?: boolean | null;
        maxDraftsPerRun?: number | null;
      };

      if (!cronExpression || !validate(cronExpression)) {
        return NextResponse.json({ error: 'Invalid cron expression' }, { status: 400 });
      }

      if (maxDraftsPerRun != null && (!Number.isInteger(maxDraftsPerRun) || maxDraftsPerRun <= 0)) {
        return NextResponse.json({ error: 'maxDraftsPerRun must be a positive integer' }, { status: 400 });
      }

      const nextRunAt = getNextRunAt(cronExpression);

      const [created] = await db
        .insert(automationSchedules)
        .values({
          researcherId: id,
          cronExpression,
          name: name ?? null,
          enabled: enabled ?? true,
          nextRunAt: nextRunAt ?? null,
          autoDraft: autoDraft ?? null,
          maxDraftsPerRun: maxDraftsPerRun ?? null,
        })
        .returning();

      return NextResponse.json(created, { status: 201 });
    } catch (err) {
      const { message, status } = apiError('create schedule', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
