import { describe, it, expect, afterAll } from 'vitest';
import { db } from '@/db/client';
import { channels, drafts, voiceProfiles, aiAuditLog } from '@/db/schema';
import { eq } from 'drizzle-orm';

describe('database schema', () => {
  let testChannelId: string;

  it('inserts and queries a channel', async () => {
    const [ch] = await db.insert(channels).values({ name: 'Test Channel', platform: 'linkedin' }).returning();
    expect(ch.id).toBeDefined();
    expect(ch.platform).toBe('linkedin');
    testChannelId = ch.id;
  });

  it('inserts a voice profile linked to the channel', async () => {
    const [vp] = await db.insert(voiceProfiles).values({ channelId: testChannelId, method: 'wizard' }).returning();
    expect(vp.channelId).toBe(testChannelId);
  });

  it('inserts a draft with pending_review status', async () => {
    const [d] = await db.insert(drafts).values({ channelId: testChannelId, contentType: 'note', status: 'pending_review' }).returning();
    expect(d.status).toBe('pending_review');
  });

  it('inserts an ai_audit_log entry', async () => {
    const [log] = await db.insert(aiAuditLog).values({ operation: 'test', model: 'claude-haiku', promptTokens: 100, completionTokens: 50 }).returning();
    expect(log.operation).toBe('test');
  });

  afterAll(async () => {
    // Clean up audit log entries created with sentinel operation value
    await db.delete(aiAuditLog).where(eq(aiAuditLog.operation, 'test'));
    if (!testChannelId) return;
    await db.delete(drafts).where(eq(drafts.channelId, testChannelId));
    await db.delete(voiceProfiles).where(eq(voiceProfiles.channelId, testChannelId));
    await db.delete(channels).where(eq(channels.id, testChannelId));
  });
});
