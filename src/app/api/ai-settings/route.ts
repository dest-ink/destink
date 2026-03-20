import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { aiModelSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { apiError } from '@/lib/errors';
import { getUserId } from '@/lib/auth-utils';
import { DEFAULT_SETTINGS, USE_CASE_LABELS } from '@/lib/ai/model-settings';

export const GET = auth(function GET(req) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const userId = await getUserId(req.auth);
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const [row] = await db.select().from(aiModelSettings).where(eq(aiModelSettings.userId, userId));
      const settings = row?.settings ? { ...DEFAULT_SETTINGS, ...row.settings } : DEFAULT_SETTINGS;

      return NextResponse.json({
        settings,
        useCases: USE_CASE_LABELS,
        defaults: DEFAULT_SETTINGS,
      });
    } catch (err) {
      const { message, status } = apiError('load AI settings', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});

export const PUT = auth(function PUT(req) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const userId = await getUserId(req.auth);
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const body = await req.json();
      const settings = { ...DEFAULT_SETTINGS, ...body.settings };

      const [existing] = await db.select({ id: aiModelSettings.id }).from(aiModelSettings)
        .where(eq(aiModelSettings.userId, userId));

      if (existing) {
        await db.update(aiModelSettings)
          .set({ settings, updatedAt: new Date() })
          .where(eq(aiModelSettings.userId, userId));
      } else {
        await db.insert(aiModelSettings).values({ userId, settings });
      }

      return NextResponse.json({ settings });
    } catch (err) {
      const { message, status } = apiError('save AI settings', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
