'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HelpModal } from '@/components/ui/help-modal';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OnboardingIntent {
  platform: 'linkedin' | 'substack';
  channelName: string;
  platformId: string | null;
  voice: {
    style: string[];
    audience: string;
    influences: string[];
    avoid: string[];
    summary: string;
  };
  researcher: {
    name: string;
    topics: string[];
    keywords: string[];
    sourceConfig: {
      subreddits: string[];
      substackFeeds: string[];
      searchQueryTemplates: string[];
      excludedDomains: string[];
    };
    shortFormPercent: number;
  };
  schedule: {
    frequency: string;
    reasoning: string;
  };
}

export interface ProvisionResult {
  channelId: string;
  channelName: string;
  platform: string;
  researcherId: string;
  researcherName: string;
  scheduleId: string;
  cronExpression: string;
  voiceProfileId: string;
}

interface ReviewStepProps {
  intent: OnboardingIntent;
  result: ProvisionResult;
}

interface ConfigField {
  key: string;
  label: string;
  type: 'string' | 'secret' | 'url' | 'number';
  required: boolean;
  helpText?: string;
  helpDetail?: {
    title: string;
    steps: string[];
  };
}

interface LogLine {
  message: string;
  color: string;
}

interface DraftPreview {
  id: string;
  title: string | null;
  contentType: string;
  hook: string | null;
}

type DashboardPhase =
  | 'credentials'     // Need credentials before proceeding
  | 'ready'           // Everything set up, ready to run research
  | 'researching'     // Research running (SSE streaming)
  | 'topics'          // Topics found, ready to generate drafts
  | 'generating'      // Generating drafts (SSE streaming)
  | 'done';           // Drafts ready

const FREQUENCY_LABELS: Record<string, string> = {
  twice_daily: 'Twice daily',
  daily: 'Daily at 8am',
  every_other_day: 'Every other day',
  weekly: 'Weekly (Mondays)',
};

// ─── Main Component ─────────────────────────────────────────────────────────

const REVIEW_PHASES: DashboardPhase[] = ['credentials', 'ready', 'researching', 'topics', 'generating', 'done'];
// Phases that are safe to restore on refresh (not transient streaming phases)
const RESTORABLE_PHASES: DashboardPhase[] = ['credentials', 'ready', 'topics', 'done'];

function getInitialReviewPhase(): DashboardPhase {
  if (typeof window === 'undefined') return 'ready';
  const hash = window.location.hash.replace('#', '') as DashboardPhase;
  if (RESTORABLE_PHASES.includes(hash)) return hash;
  // Transient phases (researching, generating) fall back to ready
  if (REVIEW_PHASES.includes(hash)) return 'ready';
  return 'ready';
}

export function ReviewStep({ intent, result }: ReviewStepProps) {
  const router = useRouter();
  const [phase, setPhaseRaw] = useState<DashboardPhase>(getInitialReviewPhase);

  // Wrap setPhase to sync hash
  const setPhase = (p: DashboardPhase | ((prev: DashboardPhase) => DashboardPhase)) => {
    setPhaseRaw(prev => {
      const next = typeof p === 'function' ? p(prev) : p;
      window.location.hash = next;
      return next;
    });
  };

  // Set hash on mount
  useEffect(() => {
    // The credential check may override, but set initial hash now
    const hash = window.location.hash.replace('#', '');
    if (!REVIEW_PHASES.includes(hash as DashboardPhase)) {
      window.location.hash = 'ready';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [topicCount, setTopicCount] = useState(0);
  const [sourceCount, setSourceCount] = useState(0);
  const [drafts, setDrafts] = useState<DraftPreview[]>([]);
  const [expandSetup, setExpandSetup] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  // Credentials state
  const [credSchema, setCredSchema] = useState<ConfigField[]>([]);
  const [credValues, setCredValues] = useState<Record<string, string>>({});
  const [credSaving, setCredSaving] = useState(false);
  const [credConfigured, setCredConfigured] = useState(false);
  const [helpDetail, setHelpDetail] = useState<{ title: string; steps: string[] } | null>(null);
  const [providerDisplayName, setProviderDisplayName] = useState('');
  const [providerOauth, setProviderOauth] = useState<{
    authPath: string; statusPath: string; buttonLabel: string;
    helpText: string; notConfiguredMessage: string;
    setupGuide?: { title: string; steps: string[] };
  } | null>(null);

  // OAuth state
  const [oauthAvailable, setOauthAvailable] = useState(false);
  const [showManualCreds, setShowManualCreds] = useState(false);

  // Sort schema: non-secret fields first
  const sortedSchema = useMemo(
    () => [...credSchema].sort((a, b) => {
      if (a.type === 'secret' && b.type !== 'secret') return 1;
      if (a.type !== 'secret' && b.type === 'secret') return -1;
      return 0;
    }),
    [credSchema],
  );

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // Check credentials on mount
  useEffect(() => {
    Promise.all([
      fetch(`/api/providers/${result.platform}`).then(r => r.json()),
      fetch(`/api/channels/${result.channelId}/credentials`).then(r => r.json()),
    ]).then(([providerData, credData]) => {
      setCredSchema(providerData.configSchema ?? []);
      setProviderDisplayName(providerData.displayName ?? result.platform);
      setProviderOauth(providerData.oauth ?? null);

      // Check OAuth availability if provider supports it
      if (providerData.oauth?.statusPath) {
        fetch(providerData.oauth.statusPath)
          .then((r: Response) => r.json())
          .then((data: { available?: boolean }) => { if (data.available) setOauthAvailable(true); })
          .catch(() => {});
      }

      if (credData.configured) {
        setCredConfigured(true);
      } else {
        setPhase('credentials');
      }
    }).catch(() => {
      setCredConfigured(false);
    });
  }, [result.channelId, result.platform]);

  const addLog = (message: string, color: string = 'text-muted-foreground') => {
    setLogs(prev => [...prev, { message, color }]);
  };

  // ── Credentials ──────────────────────────────────────────────────────────

  const handleSaveCredentials = async () => {
    for (const field of credSchema) {
      if (field.required && !credValues[field.key]?.trim()) {
        toast.error(`${field.label} is required`);
        return;
      }
    }
    setCredSaving(true);
    try {
      const res = await fetch(`/api/channels/${result.channelId}/credentials`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credValues),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error((data as { error?: string }).error ?? 'Failed to save credentials');
        return;
      }
      toast.success('Credentials saved');
      setCredConfigured(true);
      setPhase('ready');
    } catch {
      toast.error('Failed to save credentials');
    } finally {
      setCredSaving(false);
    }
  };

  const handleSkipCredentials = () => {
    setPhase('ready');
  };

  // ── Research ──────────────────────────────────────────────────────────────

  const handleRunResearch = async () => {
    setPhase('researching');
    setLogs([]);
    setExpandSetup(false);
    addLog('Starting research run...', 'text-muted-foreground');

    try {
      const res = await fetch(`/api/researchers/${result.researcherId}/run`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        addLog(`Error: ${(data as { error?: string }).error || `HTTP ${res.status}`}`, 'text-destructive');
        setPhase('ready');
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        addLog('Error: No response stream', 'text-destructive');
        setPhase('ready');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const dataLine = part.trim();
          if (!dataLine.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(dataLine.slice(6));
            handleResearchEvent(event);
          } catch {
            // skip malformed events
          }
        }
      }
      // Stream ended — if we're still in 'researching', research completed
      // but no auto-draft events came. Show 'topics' so user can manually generate.
      setPhase(prev => prev === 'researching' ? 'topics' : prev);
    } catch (err) {
      addLog(`Connection error: ${err instanceof Error ? err.message : String(err)}`, 'text-destructive');
      setPhase('ready');
    }
  };

  const handleResearchEvent = (event: Record<string, unknown>) => {
    switch (event.type) {
      case 'adapter-start':
        addLog(`Searching ${event.adapterName}...`, 'text-blue-500');
        break;
      case 'adapter-result':
        addLog(`${event.adapterName}: found ${event.sourceCount} sources`, 'text-green-500');
        break;
      case 'adapter-error':
        addLog(`${event.adapterName}: ${event.error}`, 'text-destructive');
        break;
      case 'topic-ranking':
        addLog(`Ranking complete: ${event.topicCount} topics recommended`, 'text-green-500');
        break;
      case 'run-complete':
        setRunId(event.runId as string);
        setTopicCount(event.topicCount as number);
        setSourceCount(event.sourceCount as number);
        addLog(`Research complete — ${event.sourceCount} sources, ${event.topicCount} topics`, 'text-green-500');
        // Don't go to 'topics' — if auto-draft is on, draft events will follow immediately
        // and we'll transition to 'generating'. If no draft events come, the stream ends
        // and we stay in 'researching' which the finally block handles.
        break;
      case 'run-error':
        addLog(`Research failed: ${event.error}`, 'text-destructive');
        setPhase('ready');
        break;
      // Draft events (when auto-draft is on during research)
      case 'draft-start':
        setPhase('generating');
        addLog(`Generating draft ${event.index}/${event.total}: ${event.title}...`, 'text-blue-500');
        break;
      case 'draft-complete':
        addLog(`Draft created: ${event.title}`, 'text-green-500');
        setDrafts(prev => [...prev, {
          id: event.draftId as string,
          title: event.title as string,
          contentType: 'note',
          hook: null,
        }]);
        break;
      case 'draft-error':
        addLog(`Draft failed: ${event.error}`, 'text-destructive');
        break;
      case 'drafts-done': {
        const gen = event.generated as number;
        addLog(`${gen} draft${gen !== 1 ? 's' : ''} created`, 'text-green-500');
        setPhase('done');
        break;
      }
    }
  };

  // ── Draft Generation ──────────────────────────────────────────────────────

  const handleGenerateDrafts = async () => {
    if (!runId) return;
    setPhase('generating');
    addLog('Generating drafts from research...', 'text-muted-foreground');

    try {
      const res = await fetch(
        `/api/researchers/${result.researcherId}/runs/${runId}/generate-drafts`,
        { method: 'POST' },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        addLog(`Error: ${(data as { error?: string }).error || `HTTP ${res.status}`}`, 'text-destructive');
        setPhase('topics');
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        addLog('Error: No response stream', 'text-destructive');
        setPhase('topics');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const dataLine = part.trim();
          if (!dataLine.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(dataLine.slice(6));
            handleResearchEvent(event); // Reuse same handler — draft events are same shape
          } catch {
            // skip
          }
        }
      }

      // If we didn't get a drafts-done event, transition anyway
      if (phase !== 'done') setPhase('done');
    } catch (err) {
      addLog(`Error: ${err instanceof Error ? err.message : String(err)}`, 'text-destructive');
      setPhase('topics');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const isRunning = phase === 'researching' || phase === 'generating';
  const showLog = logs.length > 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="w-full px-6 py-8 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">
            {phase === 'done'
              ? `${drafts.length} draft${drafts.length !== 1 ? 's' : ''} ready for review`
              : phase === 'topics'
                ? 'Research complete'
                : phase === 'researching'
                  ? 'Researching...'
                  : phase === 'generating'
                    ? 'Writing your drafts...'
                    : 'Your pipeline is ready.'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {phase === 'done'
              ? 'Review and approve your drafts, or go to your pipeline dashboard.'
              : phase === 'generating'
                ? `Found ${topicCount} topics — now generating drafts from the best ones.`
                : phase === 'topics'
                  ? `Found ${topicCount} topics from ${sourceCount} sources.`
                  : phase === 'credentials'
                    ? 'Add your publishing credentials so drafts can be published later.'
                    : "Everything's been set up. Review below, or jump right in."}
          </p>
        </div>

        {/* ── Credentials Step ───────────────────────────────────────────── */}
        {phase === 'credentials' && sortedSchema.length > 0 && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-5 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-foreground">
                Connect {providerDisplayName}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                These credentials are encrypted and only used to publish your approved drafts.
              </p>
            </div>

            {/* OAuth option (provider-driven) */}
            {providerOauth && oauthAvailable && !showManualCreds && (
              <div className="space-y-3">
                <Button
                  asChild
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <a href={`${providerOauth.authPath}?channelId=${result.channelId}`}>
                    {providerOauth.buttonLabel}
                  </a>
                </Button>
                <p className="text-[11px] text-muted-foreground/70">
                  {providerOauth.helpText}
                </p>
                <button
                  type="button"
                  onClick={() => setShowManualCreds(true)}
                  className="text-[11px] text-primary hover:underline"
                >
                  Enter credentials manually
                </button>
              </div>
            )}

            {/* Manual credential form */}
            {(!providerOauth || !oauthAvailable || showManualCreds) && (
              <>
                {providerOauth && !oauthAvailable && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 space-y-1">
                    <p className="text-xs text-amber-200/80">{providerOauth.notConfiguredMessage}</p>
                    {providerOauth.setupGuide && (
                      <button
                        type="button"
                        onClick={() => setHelpDetail(providerOauth!.setupGuide!)}
                        className="text-[11px] text-primary hover:underline"
                      >
                        How to set this up
                      </button>
                    )}
                  </div>
                )}
                {oauthAvailable && showManualCreds && (
                  <button
                    type="button"
                    onClick={() => setShowManualCreds(false)}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Connect with OAuth
                  </button>
                )}
                <div className="space-y-3">
                  {sortedSchema.map(field => (
                    <div key={field.key} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`cred-${field.key}`} className="text-xs">
                          {field.label} {field.required && <span className="text-destructive">*</span>}
                        </Label>
                        {field.helpDetail && (
                          <button
                            type="button"
                            onClick={() => setHelpDetail(field.helpDetail!)}
                            className="text-[11px] text-primary hover:underline"
                          >
                            How to find this
                          </button>
                        )}
                      </div>
                      <Input
                        id={`cred-${field.key}`}
                        type={field.type === 'secret' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                        placeholder={field.type === 'url' ? 'https://...' : ''}
                        value={credValues[field.key] ?? ''}
                        onChange={e => setCredValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className="bg-card border-border text-sm"
                      />
                      {field.helpText && (
                        <p className="text-[11px] text-muted-foreground/70">{field.helpText}</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <Button
                    onClick={handleSaveCredentials}
                    disabled={credSaving}
                    size="sm"
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {credSaving ? 'Saving...' : 'Save & continue'}
                  </Button>
                </div>
              </>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkipCredentials}
                className="text-muted-foreground text-xs"
              >
                Skip for now
              </Button>
            </div>
          </div>
        )}

        {/* ── Setup Summary (collapsible) ────────────────────────────────── */}
        {phase !== 'credentials' && (
          <div className="space-y-2">
            <button
              onClick={() => setExpandSetup(!expandSetup)}
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className={`transition-transform duration-200 ${expandSetup ? 'rotate-90' : ''}`}>
                ▶
              </span>
              Setup summary
              {credConfigured && (
                <span className="text-green-500 text-[10px]">credentials saved</span>
              )}
            </button>

            {expandSetup && (
              <div className="space-y-3">
                {/* Channel */}
                <div className="rounded-lg border border-border bg-card p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Channel</span>
                    <p className="text-sm font-medium text-foreground">{result.channelName}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-6 px-2"
                    onClick={() => router.push(`/channels/${result.channelId}`)}>
                    edit
                  </Button>
                </div>

                {/* Voice */}
                <div className="rounded-lg border border-border bg-card p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Voice</span>
                    <p className="text-sm text-foreground leading-relaxed">{intent.voice.summary}</p>
                    {intent.voice.influences.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Inspired by: {intent.voice.influences.join(', ')}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-6 px-2 shrink-0"
                    onClick={() => router.push(`/channels/${result.channelId}`)}>
                    edit
                  </Button>
                </div>

                {/* Research */}
                <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Research</span>
                    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-6 px-2"
                      onClick={() => router.push(`/research/${result.researcherId}`)}>
                      edit
                    </Button>
                  </div>
                  <p className="text-sm font-medium text-foreground">{intent.researcher.name}</p>
                  <div className="flex flex-wrap gap-1">
                    {intent.researcher.topics.map(topic => (
                      <span key={topic} className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        {topic}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {FREQUENCY_LABELS[intent.schedule.frequency] ?? intent.schedule.frequency}
                    {' · '}Auto-draft · {intent.researcher.shortFormPercent}% short-form
                  </p>
                </div>

                {/* Credentials link if already configured */}
                {!credConfigured && phase === 'ready' && (
                  <button
                    onClick={() => setPhase('credentials')}
                    className="text-xs text-primary hover:underline"
                  >
                    + Add publishing credentials
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Live Log ───────────────────────────────────────────────────── */}
        {showLog && (
          <div
            ref={logRef}
            className="border border-border rounded-lg bg-card/50 p-4 max-h-48 overflow-y-auto font-mono text-xs space-y-0.5"
          >
            {logs.map((line, i) => (
              <div key={i} className={line.color}>{line.message}</div>
            ))}
          </div>
        )}

        {/* ── Draft Preview Cards ────────────────────────────────────────── */}
        {drafts.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Drafts</h3>
            {drafts.map(draft => (
              <div
                key={draft.id}
                className="rounded-lg border border-border bg-card p-3 flex items-center justify-between hover:border-primary/20 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{draft.title ?? 'Untitled'}</p>
                  <p className="text-xs text-muted-foreground capitalize">{draft.contentType}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground h-6 px-2"
                  onClick={() => router.push('/drafts')}
                >
                  review
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* ── Actions ────────────────────────────────────────────────────── */}
        {phase !== 'credentials' && (
          <div className="flex items-center gap-3 pt-2">
            {/* Primary action */}
            {phase === 'ready' && (
              <Button
                onClick={handleRunResearch}
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 ease-out px-8"
              >
                Run research →
              </Button>
            )}
            {phase === 'topics' && (
              <Button
                onClick={handleGenerateDrafts}
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 ease-out px-8"
              >
                Generate drafts →
              </Button>
            )}
            {phase === 'done' && (
              <Button
                onClick={() => router.push('/drafts')}
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 ease-out px-8"
              >
                Review drafts →
              </Button>
            )}
            {isRunning && (
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                Working...
              </span>
            )}

            {/* Secondary actions */}
            {phase === 'done' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/pipelines/${result.researcherId}`)}
                className="text-muted-foreground"
              >
                Go to Dashboard
              </Button>
            )}
            {phase === 'done' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLogs([]);
                  setDrafts([]);
                  setRunId(null);
                  setPhase('ready');
                }}
                className="text-muted-foreground"
              >
                Run again
              </Button>
            )}

            {/* Escape hatch to pipeline */}
            {phase === 'topics' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/pipelines/${result.researcherId}`)}
                className="text-muted-foreground text-xs"
              >
                View pipeline →
              </Button>
            )}
          </div>
        )}
      </div>

      {helpDetail && (
        <HelpModal title={helpDetail.title} steps={helpDetail.steps} onClose={() => setHelpDetail(null)} />
      )}
    </div>
  );
}
