'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ResearchProgressEvent } from '@/lib/research/progress';

interface GenerateDraftsButtonProps {
  runId: string;
  researcherId: string;
  initialDraftsGenerated: string[] | null;
}

interface LogLine {
  timestamp: string;
  message: string;
  color: 'text-muted-foreground' | 'text-green-500' | 'text-destructive' | 'text-blue-500' | 'text-yellow-500';
}

function formatTime(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

export function GenerateDraftsButton({
  runId,
  researcherId,
  initialDraftsGenerated,
}: GenerateDraftsButtonProps) {
  const router = useRouter();
  const [draftsGenerated, setDraftsGenerated] = useState<string[] | null>(initialDraftsGenerated);
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<LogLine[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [lines]);

  const addLine = (message: string, color: LogLine['color']) => {
    setLines((prev) => [...prev, { timestamp: formatTime(), message, color }]);
  };

  const handleGenerate = async () => {
    setRunning(true);
    setLines([]);
    addLine('Starting draft generation...', 'text-muted-foreground');

    let draftsDoneIds: string[] | null = null;

    try {
      const res = await fetch(
        `/api/researchers/${researcherId}/runs/${runId}/generate-drafts`,
        { method: 'POST' },
      );

      if (!res.ok) {
        if (res.status === 409) {
          addLine('Drafts already generated for this run', 'text-yellow-500');
        } else {
          const data = await res.json().catch(() => ({}));
          addLine(
            `Error: ${(data as { error?: string }).error || `HTTP ${res.status}`}`,
            'text-destructive',
          );
        }
        setRunning(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        addLine('Error: No response stream', 'text-destructive');
        setRunning(false);
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
            const event = JSON.parse(dataLine.slice(6)) as ResearchProgressEvent;
            if (event.type === 'drafts-done') {
              draftsDoneIds = event.draftIds;
            }
            handleEvent(event);
          } catch {
            // skip malformed events
          }
        }
      }
    } catch (err) {
      addLine(
        `Connection error: ${err instanceof Error ? err.message : String(err)}`,
        'text-destructive',
      );
    } finally {
      setRunning(false);
      if (draftsDoneIds !== null && draftsDoneIds.length > 0) {
        setDraftsGenerated(draftsDoneIds);
      }
      router.refresh();
    }
  };

  const handleEvent = (event: ResearchProgressEvent) => {
    switch (event.type) {
      case 'draft-start':
        addLine(
          `Generating draft ${event.index}/${event.total}: ${event.title}...`,
          'text-blue-500',
        );
        break;
      case 'draft-complete':
        addLine(
          `Draft ${event.index}/${event.total} created: ${event.title}`,
          'text-green-500',
        );
        break;
      case 'draft-error':
        addLine(
          `Draft ${event.index}/${event.total} failed: ${event.error}`,
          'text-destructive',
        );
        break;
      case 'draft-skipped':
        addLine(
          `Skipped: ${event.title} (${event.reason})`,
          'text-muted-foreground',
        );
        break;
      case 'drafts-done':
        addLine(
          `${event.generated} draft${event.generated !== 1 ? 's' : ''} created${event.failed > 0 ? `, ${event.failed} failed` : ''}`,
          event.failed > 0 ? 'text-yellow-500' : 'text-green-500',
        );
        break;
    }
  };

  if (draftsGenerated && draftsGenerated.length > 0) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-green-600 border-green-500/20 bg-green-500/10">
          Drafts Generated ({draftsGenerated.length})
        </Badge>
        <Link href="/drafts" className="text-xs text-primary hover:underline">
          View drafts
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={handleGenerate}
        disabled={running}
        size="sm"
        variant="outline"
        className="border-border text-foreground hover:bg-accent"
      >
        {running ? 'Generating...' : 'Generate Drafts'}
      </Button>

      {lines.length > 0 && (
        <div
          ref={logRef}
          className="border border-border rounded-lg bg-card/50 p-4 max-h-60 overflow-y-auto font-mono text-xs space-y-1"
        >
          {lines.map((line, i) => (
            <div key={i} className={line.color}>
              <span className="text-muted-foreground/60">[{line.timestamp}]</span>{' '}
              {line.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
