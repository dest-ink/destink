'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Zap, ArrowRight, FileText, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Pipeline {
  researcherId: string;
  researcherName: string;
  topics: string[];
  autoDraft: boolean;
  channel: {
    id: string;
    name: string;
    platform: string;
    hasVoice: boolean;
    hasCredentials: boolean;
  } | null;
  schedule: {
    cronExpression: string;
    enabled: boolean;
    nextRunAt: string | null;
  } | null;
  lastRun: {
    id: string;
    runAt: string;
    topicCount: number;
    sourceCount: number;
    draftsGenerated: string[] | null;
  } | null;
  pendingDraftCount: number;
}

type PipelineStep = 'channel' | 'voice' | 'credentials' | 'research';

function getPipelineStatus(p: Pipeline): { steps: { key: PipelineStep; label: string; status: 'done' | 'warning' | 'pending' }[]; nextAction: string; nextHref: string; actionLabel: string } {
  const steps: { key: PipelineStep; label: string; status: 'done' | 'warning' | 'pending' }[] = [
    { key: 'channel', label: 'Channel', status: p.channel ? 'done' : 'pending' },
    { key: 'voice', label: 'Voice', status: p.channel?.hasVoice ? 'done' : 'pending' },
    { key: 'credentials', label: 'Credentials', status: p.channel?.hasCredentials ? 'done' : 'warning' },
    { key: 'research', label: 'Research', status: p.lastRun ? 'done' : 'pending' },
  ];

  if (!p.channel) {
    return { steps, nextAction: 'Link a channel to get started', nextHref: `/research/${p.researcherId}`, actionLabel: 'Set up' };
  }
  if (!p.channel.hasCredentials) {
    return { steps, nextAction: 'Add publishing credentials', nextHref: `/pipelines/${p.researcherId}`, actionLabel: 'Add credentials' };
  }
  if (!p.lastRun) {
    return { steps, nextAction: 'Run your first research', nextHref: `/pipelines/${p.researcherId}`, actionLabel: 'Run research' };
  }
  if (p.pendingDraftCount > 0) {
    return { steps, nextAction: `${p.pendingDraftCount} draft${p.pendingDraftCount !== 1 ? 's' : ''} waiting for review`, nextHref: '/drafts', actionLabel: 'Review drafts' };
  }
  return { steps, nextAction: 'All caught up', nextHref: `/pipelines/${p.researcherId}`, actionLabel: 'View pipeline' };
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function StatusDot({ status }: { status: 'done' | 'warning' | 'pending' }) {
  if (status === 'done') return <span className="w-2 h-2 rounded-full bg-green-500" />;
  if (status === 'warning') return <span className="w-2 h-2 rounded-full bg-amber-500" />;
  return <span className="w-2 h-2 rounded-full bg-border" />;
}

function PipelineCard({ pipeline }: { pipeline: Pipeline }) {
  const { steps, nextAction, nextHref, actionLabel } = getPipelineStatus(pipeline);
  const allDone = steps.every(s => s.status === 'done');

  return (
    <Link
      href={`/pipelines/${pipeline.researcherId}`}
      className="block rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200 group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
            {pipeline.researcherName}
          </h3>
          {pipeline.channel && (
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">{pipeline.channel.platform} · {pipeline.channel.name}</p>
          )}
        </div>
        {pipeline.channel && (
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-2 py-1 rounded-md bg-secondary">
            {pipeline.channel.platform}
          </span>
        )}
      </div>

      {/* Pipeline status dots */}
      <div className="flex items-center gap-1 mb-4">
        {steps.map((step, i) => (
          <div key={step.key} className="flex items-center gap-1">
            {i > 0 && <span className="w-4 h-px bg-border" />}
            <div className="flex items-center gap-1.5">
              <StatusDot status={step.status} />
              <span className="text-[11px] text-muted-foreground">{step.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Next action */}
      <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg bg-secondary/50">
        {allDone ? (
          <FileText className="w-3.5 h-3.5 text-green-500 shrink-0" />
        ) : steps.find(s => s.status === 'warning') ? (
          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        ) : (
          <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />
        )}
        <span className="text-sm text-foreground">{nextAction}</span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {pipeline.schedule?.enabled && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {pipeline.schedule.nextRunAt
                ? `Next: ${new Date(pipeline.schedule.nextRunAt).toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`
                : 'Scheduled'}
            </span>
          )}
          {pipeline.lastRun && (
            <span className="flex items-center gap-1 mt-0.5">
              Last run: {formatRelativeTime(pipeline.lastRun.runAt)} · {pipeline.lastRun.topicCount} topics
            </span>
          )}
          {!pipeline.lastRun && !pipeline.schedule?.enabled && (
            <span>Never run</span>
          )}
        </div>
        <span className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          {actionLabel} <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </Link>
  );
}

export function DashboardClient() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setPipelines(data);
      })
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div>
          <div className="h-8 w-48 bg-secondary rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-64 bg-secondary/60 rounded animate-pulse mb-8" />
          <div className="grid gap-4">
            {[1, 2].map(i => (
              <div key={i} className="h-48 rounded-xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {pipelines.length === 0
              ? 'Create your first content machine to get started.'
              : `${pipelines.length} content machine${pipelines.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Empty state */}
        {pipelines.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-border bg-card/50 px-8 py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">No content machines yet</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first one — describe your topic, platform, and style, and AI will set everything up in seconds.
            </p>
            <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 px-8">
              <Link href="/get-started">
                Create content machine →
              </Link>
            </Button>
          </div>
        )}

        {/* Pipeline cards */}
        {pipelines.length > 0 && (
          <div className="grid gap-4">
            {pipelines.map(p => (
              <PipelineCard key={p.researcherId} pipeline={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
