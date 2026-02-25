import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { voiceProfiles } from '@/db/schema';
import { analyzeVoice } from '@/lib/voice/analyzer';
import { assembleAndSavePersonaPrompt, type WizardAnswer } from '@/lib/voice/assembler';
import { buildPersonaFromWizard } from '@/lib/voice/assembler';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { channelId, method, samples, wizardAnswers } = body as {
    channelId: string;
    method: 'archive' | 'samples' | 'wizard';
    samples?: string[];
    wizardAnswers?: WizardAnswer[];
  };

  if (!channelId || !method) {
    return NextResponse.json({ error: 'channelId and method are required' }, { status: 400 });
  }

  const profileId = randomUUID();

  if (method === 'archive' || method === 'samples') {
    if (!samples || samples.length === 0) {
      return NextResponse.json({ error: 'samples array required for archive/samples method' }, { status: 400 });
    }
    const extracted = await analyzeVoice(samples, channelId, profileId);
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
    const [profile] = await db.insert(voiceProfiles).values({
      id: profileId,
      channelId,
      method: 'wizard',
      rawInput,
      extractedProfile: null,
    }).returning();

    await assembleAndSavePersonaPrompt(channelId);
    return NextResponse.json(profile, { status: 201 });
  }

  return NextResponse.json({ error: `Unknown method: ${method}` }, { status: 400 });
}
