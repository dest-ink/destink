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
  ChevronDown, ChevronRight, Pencil, Hash, Search, Globe, BookOpen,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PipelineDetailProps {
  researcher: {
    id: string;
    name: string;
    topics: string[];
    keywords: string[];
    sourceConfig: {
      subreddits: string[];
      substackFeeds: string[];
      searchQueryTemplates: string[];
      excludedDomains: string[];
    };
    autoDraft: boolean;
    shortFormPercent: number;
    maxDraftsPerRun: number;
  };
  channel: {
    id: string;
    name: string;
    platform: string;
    platformId: string | null;
    hasVoice: boolean;
    hasCredentials: boolean;
    personaPrompt: string | null;
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
  drafts: {
    id: string;
    title: string | null;
    status: string;
    contentType: string;
    createdAt: string;
    voiceConfidence: number | null;
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

export function PipelineDetail({ researcher, channel, schedule, runs, drafts: channelDrafts, pendingDraftCount }: PipelineDetailProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<ActionPhase>('idle');
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [topicCount, setTopicCount] = useState(0);
  const [sourceCount, setSourceCount] = useState(0);
  const [draftCount, setDraftCount] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  // Section visibility
  const [showChannel, setShowChannel] = useState(false);
  const [showResearch, setShowResearch] = useState(false);

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
      setPhase(prev => prev === 'researching' ? 'topics' : prev);
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
        break;
      case 'run-error':
        addLog(`Failed: ${event.error}`, 'text-destructive');
        setPhase('idle');
        break;
      case 'draft-start':
        setPhase('generating');
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

  // ── Helpers ───────────────────────────────────────────────────────────────

  const steps = [
    { label: 'Channel', done: !!channel },
    { label: 'Voice', done: channel?.hasVoice ?? false },
    { label: 'Credentials', done: hasCredentials, warning: !hasCredentials },
    { label: 'Research', done: runs.length > 0 || phase !== 'idle' },
  ];

  const isRunning = phase === 'researching' || phase === 'generating';
  const { subreddits, substackFeeds, searchQueryTemplates } = researcher.sourceConfig;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="w-full px-6 py-8 space-y-6">

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
              <Link
                href={`/research/${researcher.id}/automation`}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border hover:border-primary/20 bg-card transition-all"
              >
                <Clock className="w-3.5 h-3.5" />
                {schedule?.enabled && schedule.nextRunAt
                  ? `Next: ${new Date(schedule.nextRunAt).toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`
                  : schedule?.enabled
                    ? 'Automation on'
                    : 'Set schedule'}
              </Link>
              {phase === 'idle' && (
                <Button
                  onClick={handleRunResearch}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Run research
                </Button>
              )}
              {isRunning && (
                <span className="text-sm text-muted-foreground flex items-center gap-2 px-3">
                  <span className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  {phase === 'researching' ? 'Researching...' : 'Generating...'}
                </span>
              )}
              {phase === 'topics' && (
                <Button
                  onClick={handleGenerateDrafts}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Generate drafts
                </Button>
              )}
              {phase === 'done' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setPhase('idle'); setLogs([]); setRunId(null); }}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Run again
                </Button>
              )}
            </div>
          </div>
        </div>


        {/* ── Alerts ──────────────────────────────────────────────────── */}
        {channel && !hasCredentials && !showCredForm && (
          <button
            onClick={() => setShowCredForm(true)}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors text-left"
          >
            <KeyRound className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Publishing credentials missing</p>
              <p className="text-xs text-muted-foreground">Add your {channel.platform === 'linkedin' ? 'LinkedIn' : 'Substack'} credentials to publish approved drafts.</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        )}

        {channel && !channel.hasVoice && (
          <Link
            href={`/channels/${channel.id}`}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors"
          >
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Voice profile not set</p>
              <p className="text-xs text-muted-foreground">Set up a voice profile so drafts match your writing style.</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </Link>
        )}

        {/* ── Channel Section ────────────────────────────────────────── */}
        {channel && (
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <button
              onClick={() => setShowChannel(!showChannel)}
              className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Hash className="w-4 h-4 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium text-foreground">{channel.name}</span>
                  <span className="text-xs text-muted-foreground ml-2 capitalize">{channel.platform}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {channel.hasVoice && <span className="text-[10px] text-green-500 font-medium">Voice ✓</span>}
                {hasCredentials && <span className="text-[10px] text-green-500 font-medium">Creds ✓</span>}
                {showChannel ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>

            {showChannel && (
              <div className="px-5 py-4 border-t border-border space-y-4">
                {/* Voice summary */}
                {channel.personaPrompt && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Voice Profile</p>
                    <p className="text-xs text-foreground leading-relaxed line-clamp-4">{channel.personaPrompt.slice(0, 300)}...</p>
                  </div>
                )}

                {/* Credentials status */}
                {!hasCredentials ? (
                  <button
                    onClick={() => setShowCredForm(true)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors text-left"
                  >
                    <KeyRound className="w-4 h-4 text-amber-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Add publishing credentials</p>
                      <p className="text-xs text-muted-foreground">Required to publish to {channel.platform}</p>
                    </div>
                  </button>
                ) : (
                  <p className="text-xs text-green-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Credentials configured
                  </p>
                )}

                <Link href={`/channels/${channel.id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <Pencil className="w-3 h-3" /> Edit channel settings
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── Credentials Form (modal-like inline) ───────────────────── */}
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

        {/* ── Research Section ────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <button
            onClick={() => setShowResearch(!showResearch)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-accent/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Search className="w-4 h-4 text-muted-foreground" />
              <div>
                <span className="text-sm font-medium text-foreground">Research</span>
                <span className="text-xs text-muted-foreground ml-2">{researcher.topics.length} topics · {researcher.keywords.length} keywords</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">{researcher.shortFormPercent}% short / {100 - researcher.shortFormPercent}% long</span>
              {showResearch ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </div>
          </button>

          {showResearch && (
            <div className="px-5 py-4 border-t border-border space-y-4">
              {/* Topics */}
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Topics</p>
                <div className="flex flex-wrap gap-1.5">
                  {researcher.topics.map(t => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">{t}</span>
                  ))}
                </div>
              </div>

              {/* Keywords */}
              {researcher.keywords.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Keywords</p>
                  <div className="flex flex-wrap gap-1.5">
                    {researcher.keywords.map(k => (
                      <span key={k} className="text-xs px-2 py-0.5 rounded-md bg-secondary text-muted-foreground">{k}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sources */}
              {(subreddits.length > 0 || substackFeeds.length > 0) && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Sources</p>
                  <div className="flex flex-wrap gap-1.5">
                    {subreddits.map(s => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-md bg-secondary text-muted-foreground flex items-center gap-1">
                        <Globe className="w-3 h-3" /> r/{s}
                      </span>
                    ))}
                    {substackFeeds.map(s => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-md bg-secondary text-muted-foreground flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Settings summary */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Max {researcher.maxDraftsPerRun} drafts/run</span>
                <span>{researcher.autoDraft ? 'Auto-draft on' : 'Auto-draft off'}</span>
              </div>

              <Link href={`/research/${researcher.id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <Pencil className="w-3 h-3" /> Edit research config
              </Link>
            </div>
          )}
        </div>

        {/* ── SSE Log (when running) ──────────────────────────────── */}
        {logs.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div
              ref={logRef}
              className="rounded-lg bg-background border border-border p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-0.5"
            >
              {logs.map((line, i) => (
                <div key={i} className={line.color}>{line.message}</div>
              ))}
            </div>
          </div>
        )}

        {/* ── Drafts ─────────────────────────────────────────────────── */}
        {channelDrafts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Drafts
                {pendingDraftCount > 0 && (
                  <span className="text-xs font-normal text-primary ml-2">{pendingDraftCount} pending review</span>
                )}
              </h3>
              <Link href="/drafts" className="text-xs text-primary hover:underline">View all →</Link>
            </div>
            <div className="space-y-1.5">
              {channelDrafts.map(draft => {
                const isPending = draft.status === 'pending_review';
                const statusLabel = draft.status === 'pending_review' ? 'Pending' : draft.status === 'approved' ? 'Approved' : draft.status === 'published' ? 'Published' : draft.status === 'rejected' ? 'Rejected' : draft.status;
                const statusColor = draft.status === 'pending_review' ? 'text-amber-500' : draft.status === 'approved' ? 'text-green-500' : draft.status === 'published' ? 'text-green-500' : draft.status === 'rejected' ? 'text-muted-foreground' : 'text-muted-foreground';

                return (
                  <Link
                    key={draft.id}
                    href={`/drafts?draft=${draft.id}`}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-lg border bg-card transition-all duration-200 group ${
                      isPending ? 'border-amber-500/20 hover:border-amber-500/40' : 'border-border hover:border-primary/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-[10px] font-medium uppercase tracking-wider ${statusColor}`}>{statusLabel}</span>
                      <span className="text-sm text-foreground truncate">{draft.title ?? 'Untitled'}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] text-muted-foreground uppercase">{draft.contentType}</span>
                      {draft.voiceConfidence !== null && (
                        <span className="text-[10px] text-muted-foreground">{draft.voiceConfidence}%</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(draft.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Past Runs ──────────────────────────────────────────────── */}
        {runs.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Past Runs</h3>
              <Link href={`/research/${researcher.id}/runs`} className="text-xs text-primary hover:underline">View all →</Link>
            </div>
            <div className="space-y-2">
              {runs.map(run => {
                const draftCount = run.draftsGenerated?.length ?? 0;
                return (
                  <Link
                    key={run.id}
                    href={`/research/${researcher.id}/runs/${run.id}`}
                    className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card text-sm hover:border-primary/20 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
                        {new Date(run.runAt).toLocaleDateString('en-US', {
                          month: 'numeric', day: 'numeric', year: 'numeric',
                        })}{' '}
                        {new Date(run.runAt).toLocaleTimeString('en-US', {
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                      {channel && (
                        <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                          {channel.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{run.sourceCount} sources</span>
                      <span className="text-xs text-muted-foreground">{run.topicCount} topics</span>
                      {draftCount > 0 && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 border border-green-500/20">
                          {draftCount} drafts
                        </span>
                      )}
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
