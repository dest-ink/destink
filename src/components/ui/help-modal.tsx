'use client';
import { Fragment, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface HelpModalProps {
  title: string;
  steps: string[];
  onClose: () => void;
}

/**
 * Renders a step string with simple formatting:
 * - [text](url) → clickable link
 * - `code` → inline code styling
 * - \n → line break
 *
 * All variable substitution (e.g. {APP_URL}) should be done server-side
 * before the data reaches this component.
 */
function renderStep(raw: string) {
  const parts: (string | ReactNode)[] = [];
  const regex = /\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\n/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      parts.push(raw.slice(lastIndex, match.index));
    }
    if (match[1] && match[2]) {
      parts.push(
        <a
          key={match.index}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {match[1]}
        </a>
      );
    } else if (match[3]) {
      parts.push(
        <code key={match.index} className="text-[11px] bg-muted/50 px-1 py-0.5 rounded font-mono">
          {match[3]}
        </code>
      );
    } else if (match[0] === '\n') {
      parts.push(<br key={match.index} />);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < raw.length) {
    parts.push(raw.slice(lastIndex));
  }

  return <>{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</>;
}

export function HelpModal({ title, steps, onClose }: HelpModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 max-h-[80vh] overflow-y-auto">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-muted-foreground">
              <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span className="leading-relaxed">{renderStep(step)}</span>
            </li>
          ))}
        </ol>
        <div className="pt-2">
          <Button size="sm" onClick={onClose}>Got it</Button>
        </div>
      </div>
    </div>
  );
}
