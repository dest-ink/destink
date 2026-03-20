import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { drafts, channels } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { apiError } from '@/lib/errors';
import { callClaude } from '@/lib/ai/client';

export const POST = auth(function POST(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const { id } = await (ctx?.params as Promise<{ id: string }>);
      const body = await req.json();
      const { message, hook, draftBody, cta } = body as {
        message: string;
        hook: string;
        draftBody: string;
        cta: string;
      };

      if (!message?.trim()) {
        return NextResponse.json({ error: 'Message is required' }, { status: 400 });
      }

      // Load draft for context
      const [draft] = await db.select().from(drafts).where(eq(drafts.id, id));
      if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

      // Load channel for voice context
      const [channel] = await db.select().from(channels).where(eq(channels.id, draft.channelId));
      const voiceContext = channel?.personaPrompt || '';

      const systemPrompt = `You are an AI writing assistant helping edit a draft article.

${voiceContext ? `Voice profile:\n${voiceContext}\n\n` : ''}The user will provide the current draft content and a request for changes.

Return ONLY a JSON object with the modified fields. Only include fields that changed.
The shape is: { "hook": "...", "body": "...", "cta": "..." }

Rules:
- Maintain the same voice and style as the original
- Only modify what the user asks to change
- Keep the same markdown formatting
- Return valid JSON only, no explanation`;

      const userPrompt = `Current draft:

HOOK:
${hook || draft.hook || ''}

BODY:
${draftBody || draft.body || ''}

CTA:
${cta || draft.cta || ''}

---

User request: ${message}`;

      const raw = await callClaude({
        model: 'claude-sonnet-4-6',
        system: systemPrompt,
        prompt: userPrompt,
        maxTokens: 4096,
        audit: {
          operation: 'draft-ai-edit',
          channelId: draft.channelId,
          entityType: 'draft',
          entityId: draft.id,
        },
      });

      const edits = JSON.parse(raw) as { hook?: string; body?: string; cta?: string };

      // Save the edits to the database
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (edits.hook) updates.hook = edits.hook;
      if (edits.body) updates.body = edits.body;
      if (edits.cta) updates.cta = edits.cta;

      await db.update(drafts).set(updates).where(eq(drafts.id, id));

      return NextResponse.json({ edits });
    } catch (err) {
      const { message, status } = apiError('AI edit draft', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
