import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { apiError } from '@/lib/errors';
import { parseOnboardingIntent } from '@/lib/onboarding/parse-intent';
import { provisionFromIntent } from '@/lib/onboarding/provision';

export const POST = auth(function POST(req) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    let body: { input: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body.input || typeof body.input !== 'string' || body.input.trim().length < 10) {
      return NextResponse.json(
        { error: 'Please describe what you want to publish about (at least a sentence).' },
        { status: 400 },
      );
    }

    try {
      const intent = await parseOnboardingIntent(body.input.trim());
      const result = await provisionFromIntent(intent);
      return NextResponse.json({ intent, result }, { status: 201 });
    } catch (err) {
      const { message, status } = apiError('set up your content machine', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
