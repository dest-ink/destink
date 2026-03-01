'use client';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import type { ResearchProgressEvent } from '@/lib/research/progress';

interface ResearchRunPanelProps {
  researcherId: string;
}

interface LogLine {
  timestamp: string;
  message: string;
  color: 'text-muted-foreground' | 'text-green-500' | 'text-destructive' | 'text-blue-500';
}

function formatTime(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

export function ResearchRunPanel({ researcherId }: ResearchRunPanelProps) {
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

  const handleRun = async () => {
    setRunning(true);
    setLines([]);
    addLine('Starting research run...', 'text-muted-foreground');

    try {
      const res = await fetch(`/api/researchers/${researcherId}/run`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        addLine(
          `Error: ${(data as { error?: string }).error || `HTTP ${res.status}`}`,
          'text-destructive',
        );
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
    }
  };

  const handleEvent = (event: ResearchProgressEvent) => {
    switch (event.type) {
      case 'adapter-start':
        addLine(`Searching ${event.adapterName}...`, 'text-blue-500');
        break;
      case 'adapter-result':
        addLine(
          `${event.adapterName}: found ${event.sourceCount} source${event.sourceCount !== 1 ? 's' : ''}`,
          'text-green-500',
        );
        break;
      case 'adapter-error':
        addLine(`${event.adapterName}: ${event.error}`, 'text-destructive');
        break;
      case 'topic-ranking':
        addLine(
          `Topic ranking complete: ${event.topicCount} topic${event.topicCount !== 1 ? 's' : ''} recommended`,
          'text-green-500',
        );
        break;
      case 'run-complete':
        addLine(
          `Run complete — ${event.sourceCount} sources, ${event.topicCount} topics (run ${event.runId.slice(0, 8)})`,
          'text-green-500',
        );
        break;
      case 'run-error':
        addLine(`Run failed: ${event.error}`, 'text-destructive');
        break;
    }
  };

  return (
    <div className="space-y-3">
      <Button
        onClick={handleRun}
        disabled={running}
        size="sm"
        className="bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {running ? 'Running...' : 'Run Research'}
      </Button>

      {lines.length > 0 && (
        <div
          ref={logRef}
          className="border border-border rounded-lg bg-card/50 p-4 max-h-80 overflow-y-auto font-mono text-xs space-y-1"
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
