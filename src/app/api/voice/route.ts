import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { voiceProfiles } from '@/db/schema';
import { analyzeVoice } from '@/lib/voice/analyzer';
import {
  assembleAndSavePersonaPrompt,
  buildPersonaFromWizard,
  type WizardAnswer,
} from '@/lib/voice/assembler';
import { randomUUID } from 'crypto';
import { auth } from '@/auth';
import { apiError } from '@/lib/errors';
import { getUserId } from '@/lib/auth-utils';

export const POST = auth(function POST(req) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    let body: {
      channelId: string;
      method: 'archive' | 'samples' | 'wizard';
      samples?: string[];
      wizardAnswers?: WizardAnswer[];
    };

    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { channelId, method, samples, wizardAnswers } = body;

    if (!channelId || !method) {
      return NextResponse.json({ error: 'channelId and method are required' }, { status: 400 });
    }

    const userId = await getUserId(req.auth);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profileId = randomUUID();

    try {
      if (method === 'archive' || method === 'samples') {
        if (!samples || samples.length === 0) {
          return NextResponse.json({ error: 'samples array required for archive/samples method' }, { status: 400 });
        }
        const extracted = await analyzeVoice(samples, channelId, profileId, userId);
        const [profile] = await db.insert(voiceProfiles).values({
          id: profileId,
          channelId,
          method,
          rawInput: samples.join('\n\n---\n\n'),
          extractedProfile: extracted,
        }).returning();

        await assembleAndSavePersonaPrompt(channelId);
        return NextResponse.json(profile, { status: 201 });
      }

      if (method === 'wizard') {
        if (!wizardAnswers) {
          return NextResponse.json({ error: 'wizardAnswers required for wizard method' }, { status: 400 });
        }
        const rawInput = buildPersonaFromWizard(wizardAnswers);

        // Extract a structured voice profile from the wizard Q&A text
        // (same as archive/samples methods do via analyzeVoice)
        const extracted = await analyzeVoice([rawInput], channelId, profileId, userId);

        const [profile] = await db.insert(voiceProfiles).values({
          id: profileId,
          channelId,
          method: 'wizard',
          rawInput,
          extractedProfile: extracted,
        }).returning();

        await assembleAndSavePersonaPrompt(channelId);
        return NextResponse.json(profile, { status: 201 });
      }

      return NextResponse.json({ error: `Unknown method: ${method}` }, { status: 400 });
    } catch (err) {
      const { message, status } = apiError('train voice profile', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
