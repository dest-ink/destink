import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { researchers, automationSchedules } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { ScheduleList } from '@/components/research/ScheduleList';

export const dynamic = 'force-dynamic';

interface AutomationPageProps {
  params: Promise<{ id: string }>;
}

export default async function AutomationPage({ params }: AutomationPageProps) {
  const { id } = await params;

  const [researcher] = await db
    .select()
    .from(researchers)
    .where(eq(researchers.id, id));
  if (!researcher) notFound();

  const schedules = await db
    .select()
    .from(automationSchedules)
    .where(eq(automationSchedules.researcherId, id))
    .orderBy(asc(automationSchedules.createdAt));

  // Serialize dates to ISO strings for client component
  const serializedSchedules = schedules.map((s) => ({
    id: s.id,
    name: s.name,
    cronExpression: s.cronExpression,
    enabled: s.enabled,
    nextRunAt: s.nextRunAt ? s.nextRunAt.toISOString() : null,
    autoDraft: s.autoDraft,
    maxDraftsPerRun: s.maxDraftsPerRun,
  }));

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-5 border-b border-border shrink-0">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2 mb-2">
          <Link href={`/research/${id}`}>&larr; Back to {researcher.name}</Link>
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">
            {researcher.name} &mdash; Automation
          </h1>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <ScheduleList
          initialSchedules={serializedSchedules}
          researcherId={id}
          researcherDefaults={{
            maxDraftsPerRun: researcher.maxDraftsPerRun,
            autoDraft: researcher.autoDraft,
          }}
        />
      </div>
    </div>
  );
}
