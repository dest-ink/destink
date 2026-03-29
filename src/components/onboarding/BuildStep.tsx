'use client';
import { useEffect, useState } from 'react';

const BUILD_STEPS = [
  { label: 'Understanding your intent', icon: '◈' },
  { label: 'Creating your channel', icon: '◆' },
  { label: 'Building your voice profile', icon: '◇' },
  { label: 'Configuring researcher', icon: '◉' },
  { label: 'Setting up automation', icon: '◎' },
];

interface BuildStepProps {
  voiceSummary?: string;
}

export function BuildStep({ voiceSummary }: BuildStepProps) {
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    BUILD_STEPS.forEach((_, i) => {
      timers.push(
        setTimeout(() => setCompletedCount(i + 1), 600 + i * 800),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-semibold text-foreground">
            Setting up your pipeline...
          </h2>
        </div>

        <div className="space-y-3">
          {BUILD_STEPS.map((step, i) => {
            const done = i < completedCount;
            const active = i === completedCount;
            return (
              <div
                key={step.label}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all duration-300 ease-out ${
                  done
                    ? 'border-primary/30 bg-primary/5'
                    : active
                      ? 'border-border bg-card'
                      : 'border-transparent bg-transparent opacity-40'
                }`}
              >
                <span className="w-5 h-5 flex items-center justify-center text-xs shrink-0">
                  {done ? (
                    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-primary">
                      <path d="M3 8.5l3.5 3.5L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : active ? (
                    <span className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                  )}
                </span>

                <span className={`text-sm ${
                  done ? 'text-foreground font-medium' : 'text-muted-foreground'
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {completedCount >= 3 && voiceSummary && (
          <div className="rounded-lg border border-border bg-card p-4 transition-all duration-300 ease-out">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Voice Preview</p>
            <p className="text-sm text-foreground leading-relaxed italic">
              "{voiceSummary}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
