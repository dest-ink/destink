import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { channels, draftPreferences } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
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

      // Verify channel ownership
      const [channel] = await db.select({ id: channels.id }).from(channels)
        .where(and(eq(channels.id, id), eq(channels.userId, userId)));
      if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const [prefs] = await db.select().from(draftPreferences)
        .where(eq(draftPreferences.channelId, id));

      return NextResponse.json(prefs ?? { channelId: id });
    } catch (err) {
      const { message, status } = apiError('load draft preferences', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});

export const PUT = auth(function PUT(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const userId = await getUserId(req.auth);
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const { id } = await (ctx?.params as Promise<{ id: string }>);

      // Verify channel ownership
      const [channel] = await db.select({ id: channels.id }).from(channels)
        .where(and(eq(channels.id, id), eq(channels.userId, userId)));
      if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const body = await req.json();

      // Check if preferences exist
      const [existing] = await db.select({ id: draftPreferences.id }).from(draftPreferences)
        .where(eq(draftPreferences.channelId, id));

      const values = {
        channelId: id,
        ...(body.noteLengthMin !== undefined && { noteLengthMin: body.noteLengthMin }),
        ...(body.noteLengthMax !== undefined && { noteLengthMax: body.noteLengthMax }),
        ...(body.articleLengthMin !== undefined && { articleLengthMin: body.articleLengthMin }),
        ...(body.articleLengthMax !== undefined && { articleLengthMax: body.articleLengthMax }),
        ...(body.vocabularyLevel !== undefined && { vocabularyLevel: body.vocabularyLevel }),
        ...(body.jargonHandling !== undefined && { jargonHandling: body.jargonHandling }),
        ...(body.preferredPhrases !== undefined && { preferredPhrases: body.preferredPhrases }),
        ...(body.avoidedPhrases !== undefined && { avoidedPhrases: body.avoidedPhrases }),
        ...(body.useEmDashes !== undefined && { useEmDashes: body.useEmDashes }),
        ...(body.useOxfordComma !== undefined && { useOxfordComma: body.useOxfordComma }),
        ...(body.useSemicolons !== undefined && { useSemicolons: body.useSemicolons }),
        ...(body.useExclamationMarks !== undefined && { useExclamationMarks: body.useExclamationMarks }),
        ...(body.useEllipsis !== undefined && { useEllipsis: body.useEllipsis }),
        ...(body.useParenheticals !== undefined && { useParenheticals: body.useParenheticals }),
        ...(body.headlineCase !== undefined && { headlineCase: body.headlineCase }),
        ...(body.emphasisStyle !== undefined && { emphasisStyle: body.emphasisStyle }),
        ...(body.useAllCaps !== undefined && { useAllCaps: body.useAllCaps }),
        ...(body.paragraphLength !== undefined && { paragraphLength: body.paragraphLength }),
        ...(body.useSubheadings !== undefined && { useSubheadings: body.useSubheadings }),
        ...(body.useBulletLists !== undefined && { useBulletLists: body.useBulletLists }),
        ...(body.useNumberedLists !== undefined && { useNumberedLists: body.useNumberedLists }),
        ...(body.useBlockquotes !== undefined && { useBlockquotes: body.useBlockquotes }),
        ...(body.humorLevel !== undefined && { humorLevel: body.humorLevel }),
        ...(body.formalityLevel !== undefined && { formalityLevel: body.formalityLevel }),
        ...(body.opinionStrength !== undefined && { opinionStrength: body.opinionStrength }),
        ...(body.ctaStyle !== undefined && { ctaStyle: body.ctaStyle }),
        updatedAt: new Date(),
      };

      let result;
      if (existing) {
        [result] = await db.update(draftPreferences)
          .set(values)
          .where(eq(draftPreferences.channelId, id))
          .returning();
      } else {
        [result] = await db.insert(draftPreferences)
          .values(values)
          .returning();
      }

      return NextResponse.json(result);
    } catch (err) {
      const { message, status } = apiError('save draft preferences', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
