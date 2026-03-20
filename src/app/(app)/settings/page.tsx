import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getUserId } from '@/lib/auth-utils';
import { db } from '@/db/client';
import { channels, researchers } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { SettingsClient } from '@/components/settings/SettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await auth();
  const userId = await getUserId(session);
  if (!userId) redirect('/login');

  const allChannels = await db
    .select({ id: channels.id, name: channels.name, platform: channels.platform })
    .from(channels)
    .where(eq(channels.userId, userId))
    .orderBy(desc(channels.createdAt));

  const allResearchers = await db
    .select({ id: researchers.id, name: researchers.name })
    .from(researchers)
    .where(eq(researchers.userId, userId))
    .orderBy(desc(researchers.createdAt));

  return (
    <SettingsClient
      initialChannels={allChannels}
      initialResearchers={allResearchers}
    />
  );
}
