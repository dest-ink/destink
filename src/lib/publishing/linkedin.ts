import type { drafts, channels } from '@/db/schema';

type DraftRow = typeof drafts.$inferSelect;
type ChannelRow = typeof channels.$inferSelect;

export async function publishToLinkedIn(_draft: DraftRow, _channel: ChannelRow): Promise<unknown> {
  throw new Error('LinkedIn publisher not yet implemented — see Task 7.2');
}
