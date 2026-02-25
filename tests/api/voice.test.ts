import { describe, it, expect, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '@/db/client';
import { channels, voiceProfiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { POST } from '@/app/api/voice/route';

// Helper to build a POST NextRequest
function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/voice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/voice', () => {
  let channelId: string;

  // Set up a test channel once before all tests
  afterAll(async () => {
    if (channelId) {
      await db.delete(channels).where(eq(channels.id, channelId));
    }
  });

  it('returns 400 when channelId is missing', async () => {
    const res = await POST(makeRequest({ method: 'wizard', wizardAnswers: [] }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/channelId/i);
  });

  it('returns 400 when method is missing', async () => {
    const res = await POST(makeRequest({ channelId: 'some-id' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/method/i);
  });

  it('returns 400 when samples method has no samples', async () => {
    const res = await POST(makeRequest({ channelId: 'some-id', method: 'samples' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/samples/i);
  });

  it('returns 400 when wizard method has no wizardAnswers', async () => {
    const res = await POST(makeRequest({ channelId: 'some-id', method: 'wizard' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/wizardAnswers/i);
  });

  it('returns 201 and saves voice profile for wizard method', async () => {
    // Create a real channel so FK is satisfied
    const [ch] = await db.insert(channels).values({
      name: 'Voice Test Channel',
      platform: 'linkedin',
    }).returning();
    channelId = ch.id;

    const res = await POST(makeRequest({
      channelId,
      method: 'wizard',
      wizardAnswers: [
        { question: 'Describe your writing style in 3 words', answer: 'direct, sharp, human' },
        { question: 'Who is your ideal reader?', answer: 'Founders and senior engineers' },
      ],
    }));

    expect(res.status).toBe(201);
    const profile = await res.json();
    expect(profile.channelId).toBe(channelId);
    expect(profile.method).toBe('wizard');

    // Verify persisted in DB
    const [saved] = await db.select()
      .from(voiceProfiles)
      .where(eq(voiceProfiles.id, profile.id));
    expect(saved).toBeDefined();
    expect(saved.rawInput).toContain('direct, sharp, human');

    // Verify personaPrompt was assembled on the channel
    const [updatedCh] = await db.select()
      .from(channels)
      .where(eq(channels.id, channelId));
    expect(updatedCh.personaPrompt).toContain('direct, sharp, human');
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
