import { db } from '@/db/client';
import { channels, researchers } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { SettingsClient } from '@/components/settings/SettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const allChannels = await db
    .select({ id: channels.id, name: channels.name, platform: channels.platform })
    .from(channels)
    .orderBy(desc(channels.createdAt));

  const allResearchers = await db
    .select({ id: researchers.id, name: researchers.name })
    .from(researchers)
    .orderBy(desc(researchers.createdAt));

  return (
    <SettingsClient
      initialChannels={allChannels}
      initialResearchers={allResearchers}
    />
  );
}
