import Link from 'next/link';
import { db } from '@/db/client';
import { channels } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { ResearcherForm } from '@/components/research/ResearcherForm';

export const dynamic = 'force-dynamic';

export default async function NewResearcherPage() {
  const allChannels = await db
    .select({ id: channels.id, name: channels.name, platform: channels.platform })
    .from(channels)
    .orderBy(desc(channels.createdAt));

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2">
          <Link href="/research">&larr; Back to research</Link>
        </Button>
      </div>

      <h1 className="text-xl font-semibold text-foreground mb-8">New Researcher</h1>

      <ResearcherForm allChannels={allChannels} />
    </div>
  );
}
