'use client';
import { Button } from '@/components/ui/button';

interface PlatformStepProps {
  onSelect: (platform: string) => void;
}

const platforms = [
  {
    id: 'linkedin',
    label: 'LinkedIn',
    description: 'Short-form posts and articles',
  },
  {
    id: 'substack',
    label: 'Substack',
    description: 'Newsletters and long-form essays',
  },
];

export function PlatformStep({ onSelect }: PlatformStepProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            Where do you publish?
          </h1>
          <p className="text-sm text-muted-foreground">
            Pick the platform you want to set up first. You can add more later.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {platforms.map(p => (
            <Button
              key={p.id}
              variant="outline"
              onClick={() => onSelect(p.label)}
              className="w-full h-auto py-4 px-5 flex flex-col items-start gap-0.5 text-left border-border hover:border-primary hover:bg-primary/5 transition-all duration-200"
            >
              <span className="text-base font-medium text-foreground">{p.label}</span>
              <span className="text-xs text-muted-foreground font-normal">{p.description}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
