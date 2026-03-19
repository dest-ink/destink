'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft, Play, FileText, Clock, Settings as SettingsIcon,
  CheckCircle2, AlertCircle, Circle, KeyRound, ArrowRight, RotateCcw,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PipelineDetailProps {
  researcher: {
    id: string;
    name: string;
    topics: string[];
    autoDraft: boolean;
    shortFormPercent: number;
    maxDraftsPerRun: number;
  };
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
  runs: {
    id: string;
    runAt: string;
    topicCount: number;
    sourceCount: number;
    draftsGenerated: string[] | null;
    channelId: string;
  }[];
  pendingDraftCount: number;
}

interface ConfigField {
  key: string;
  label: string;
  type: 'string' | 'secret' | 'url' | 'number';
  required: boolean;
}

interface LogLine {
  message: string;
  color: string;
}

type ActionPhase = 'idle' | 'researching' | 'topics' | 'generating' | 'done';

// ─── Component ──────────────────────────────────────────────────────────────

export function PipelineDetail({ researcher, channel, schedule, runs, pendingDraftCount }: PipelineDetailProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<ActionPhase>('idle');
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [topicCount, setTopicCount] = useState(0);
  const [sourceCount, setSourceCount] = useState(0);
  const [draftCount, setDraftCount] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  // Credentials
  const [credSchema, setCredSchema] = useState<ConfigField[]>([]);
  const [credValues, setCredValues] = useState<Record<string, string>>({});
  const [credSaving, setCredSaving] = useState(false);
  const [showCredForm, setShowCredForm] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(channel?.hasCredentials ?? false);

  const sortedSchema = useMemo(
    () => [...credSchema].sort((a, b) => (a.type === 'secret' ? 1 : 0) - (b.type === 'secret' ? 1 : 0)),
    [credSchema],
  );

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // Load credential schema
  useEffect(() => {
    if (!channel) return;
    fetch(`/api/providers/${channel.platform}`)
      .then(r => r.json())
      .then(data => setCredSchema(data.configSchema ?? []))
      .catch(() => {});
  }, [channel]);

  const addLog = (message: string, color: string = 'text-muted-foreground') => {
    setLogs(prev => [...prev, { message, color }]);
  };

  // ── Credentials ──────────────────────────────────────────────────────────

  const handleSaveCredentials = async () => {
    if (!channel) return;
    for (const field of credSchema) {
      if (field.required && !credValues[field.key]?.trim()) {
        toast.error(`${field.label} is required`);
        return;
      }
    }
    setCredSaving(true);
    try {
      const res = await fetch(`/api/channels/${channel.id}/credentials`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credValues),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error((data as { error?: string }).error ?? 'Failed to save');
        return;
      }
      toast.success('Credentials saved');
      setHasCredentials(true);
      setShowCredForm(false);
    } catch {
      toast.error('Failed to save credentials');
    } finally {
      setCredSaving(false);
    }
  };

  // ── Research ──────────────────────────────────────────────────────────────

  const handleRunResearch = async () => {
    setPhase('researching');
    setLogs([]);
    setDraftCount(0);
    addLog('Starting research run...', 'text-muted-foreground');

    try {
      const res = await fetch(`/api/researchers/${researcher.id}/run`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        addLog(`Error: ${(data as { error?: string }).error || `HTTP ${res.status}`}`, 'text-destructive');
        setPhase('idle');
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { addLog('Error: No stream', 'text-destructive'); setPhase('idle'); return; }

      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          try { handleSSE(JSON.parse(line.slice(6))); } catch {}
        }
      }
    } catch (err) {
      addLog(`Error: ${err instanceof Error ? err.message : String(err)}`, 'text-destructive');
      setPhase('idle');
    }
  };

  const handleGenerateDrafts = async () => {
    if (!runId) return;
    setPhase('generating');
    addLog('Generating drafts...', 'text-muted-foreground');

    try {
      const res = await fetch(`/api/researchers/${researcher.id}/runs/${runId}/generate-drafts`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        addLog(`Error: ${(data as { error?: string }).error || `HTTP ${res.status}`}`, 'text-destructive');
        setPhase('topics');
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setPhase('topics'); return; }

      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          try { handleSSE(JSON.parse(line.slice(6))); } catch {}
        }
      }
      if (phase !== 'done') setPhase('done');
    } catch (err) {
      addLog(`Error: ${err instanceof Error ? err.message : String(err)}`, 'text-destructive');
      setPhase('topics');
    }
  };

  const handleSSE = (event: Record<string, unknown>) => {
    switch (event.type) {
      case 'adapter-start':
        addLog(`Searching ${event.adapterName}...`, 'text-blue-500');
        break;
      case 'adapter-result':
        addLog(`${event.adapterName}: ${event.sourceCount} sources`, 'text-green-500');
        break;
      case 'adapter-error':
        addLog(`${event.adapterName}: ${event.error}`, 'text-destructive');
        break;
      case 'topic-ranking':
        addLog(`Ranked ${event.topicCount} topics`, 'text-green-500');
        break;
      case 'run-complete':
        setRunId(event.runId as string);
        setTopicCount(event.topicCount as number);
        setSourceCount(event.sourceCount as number);
        addLog(`Done — ${event.sourceCount} sources, ${event.topicCount} topics`, 'text-green-500');
        setPhase('topics');
        break;
      case 'run-error':
        addLog(`Failed: ${event.error}`, 'text-destructive');
        setPhase('idle');
        break;
      case 'draft-start':
        addLog(`Drafting ${event.index}/${event.total}: ${event.title}`, 'text-blue-500');
        break;
      case 'draft-complete':
        addLog(`Created: ${event.title}`, 'text-green-500');
        setDraftCount(prev => prev + 1);
        break;
      case 'draft-error':
        addLog(`Failed: ${event.error}`, 'text-destructive');
        break;
      case 'drafts-done':
        addLog(`${event.generated} draft${(event.generated as number) !== 1 ? 's' : ''} ready`, 'text-green-500');
        setPhase('done');
        break;
    }
  };

  // ── Pipeline Status ───────────────────────────────────────────────────────

  const steps = [
    { label: 'Channel', done: !!channel, icon: CheckCircle2 },
    { label: 'Voice', done: channel?.hasVoice ?? false, icon: CheckCircle2 },
    { label: 'Credentials', done: hasCredentials, warning: !hasCredentials, icon: hasCredentials ? CheckCircle2 : AlertCircle },
    { label: 'Research', done: runs.length > 0 || phase !== 'idle', icon: runs.length > 0 ? CheckCircle2 : Circle },
  ];

  const isRunning = phase === 'researching' || phase === 'generating';

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="w-full px-6 py-8 space-y-8">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">{researcher.name}</h1>
              {channel && (
                <p className="text-sm text-muted-foreground mt-0.5 capitalize">{channel.platform} · {channel.name}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {schedule?.enabled && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary">
                  <Clock className="w-3 h-3" />
                  {schedule.nextRunAt
                    ? new Date(schedule.nextRunAt).toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
                    : 'Scheduled'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Pipeline Status Bar ────────────────────────────────────── */}
        <div className="flex items-center gap-2 p-4 rounded-xl bg-card border border-border shadow-sm">
          {steps.map((step, i) => (
            <div key={step.label} className="flex items-center gap-2">
              {i > 0 && <span className="w-6 h-px bg-border" />}
              <div className="flex items-center gap-1.5">
                {step.done ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : step.warning ? (
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground/30" />
                )}
                <span className={`text-xs font-medium ${step.done ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Credentials Alert ──────────────────────────────────────── */}
        {!hasCredentials && channel && !showCredForm && (
          <button
            onClick={() => setShowCredForm(true)}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors text-left"
          >
            <KeyRound className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Add publishing credentials</p>
              <p className="text-xs text-muted-foreground">Required to publish approved drafts to {channel.platform}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto" />
          </button>
        )}

        {/* ── Credentials Form ───────────────────────────────────────── */}
        {showCredForm && channel && sortedSchema.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Connect {channel.platform === 'linkedin' ? 'LinkedIn' : 'Substack'}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setShowCredForm(false)} className="text-xs text-muted-foreground">
                Cancel
              </Button>
            </div>
            <div className="space-y-3">
              {sortedSchema.map(field => (
                <div key={field.key} className="space-y-1">
                  <Label htmlFor={`cred-${field.key}`} className="text-xs">
                    {field.label} {field.required && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    id={`cred-${field.key}`}
                    type={field.type === 'secret' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                    value={credValues[field.key] ?? ''}
                    onChange={e => setCredValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="bg-background border-border text-sm"
                  />
                </div>
              ))}
            </div>
            <Button onClick={handleSaveCredentials} disabled={credSaving} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              {credSaving ? 'Saving...' : 'Save credentials'}
            </Button>
          </div>
        )}

        {/* ── Action Zone ────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
          {/* Primary action */}
          <div className="flex items-center gap-3">
            {phase === 'idle' && (
              <Button
                onClick={handleRunResearch}
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
              >
                <Play className="w-4 h-4 mr-2" />
                Run research
              </Button>
            )}
            {phase === 'topics' && (
              <Button
                onClick={handleGenerateDrafts}
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
              >
                <FileText className="w-4 h-4 mr-2" />
                Generate drafts
              </Button>
            )}
            {phase === 'done' && (
              <div className="flex items-center gap-3">
                <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link href="/drafts">
                    <FileText className="w-4 h-4 mr-2" />
                    Review {draftCount} draft{draftCount !== 1 ? 's' : ''}
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setPhase('idle'); setLogs([]); setRunId(null); }}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Run again
                </Button>
              </div>
            )}
            {isRunning && (
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                {phase === 'researching' ? 'Researching...' : 'Generating drafts...'}
              </span>
            )}

            {/* Pending drafts notice */}
            {phase === 'idle' && pendingDraftCount > 0 && (
              <Link href="/drafts" className="text-sm text-primary hover:underline flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                {pendingDraftCount} pending draft{pendingDraftCount !== 1 ? 's' : ''}
              </Link>
            )}
          </div>

          {/* SSE Log */}
          {logs.length > 0 && (
            <div
              ref={logRef}
              className="rounded-lg bg-background border border-border p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-0.5"
            >
              {logs.map((line, i) => (
                <div key={i} className={line.color}>{line.message}</div>
              ))}
            </div>
          )}
        </div>

        {/* ── Past Runs ──────────────────────────────────────────────── */}
        {runs.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Past Runs</h3>
            <div className="space-y-2">
              {runs.map(run => (
                <div key={run.id} className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card text-sm">
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">
                      {new Date(run.runAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                      })}
                    </span>
                    <span className="text-foreground">{run.topicCount} topics · {run.sourceCount} sources</span>
                  </div>
                  {run.draftsGenerated && run.draftsGenerated.length > 0 && (
                    <span className="text-xs text-muted-foreground">{run.draftsGenerated.length} drafts</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Settings Links ─────────────────────────────────────────── */}
        <div className="flex items-center gap-4 pt-4 border-t border-border">
          {channel && (
            <Link href={`/channels/${channel.id}`} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              <SettingsIcon className="w-3 h-3" /> Edit channel
            </Link>
          )}
          <Link href={`/research/${researcher.id}`} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            <SettingsIcon className="w-3 h-3" /> Edit researcher
          </Link>
          {channel && (
            <Link href={`/research/${researcher.id}/automation`} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              <Clock className="w-3 h-3" /> Edit automation
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
