'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface PromptStepProps {
  onSubmit: (input: string) => void;
  loading: boolean;
}

export function PromptStep({ onSubmit, loading }: PromptStepProps) {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    if (input.trim().length >= 10) {
      onSubmit(input.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      <div className="w-full max-w-xl space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            What do you want to publish about?
          </h1>
          <p className="text-sm text-muted-foreground">
            Tell us the topic, platform, and your style. We'll set everything up.
          </p>
        </div>

        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="I write about AI and developer tools on LinkedIn. My style is direct and analytical, like Paul Graham meets Packy McCormick."
          className="min-h-[140px] bg-card border-border resize-none text-base leading-relaxed"
          autoFocus
          disabled={loading}
          aria-label="Describe what you want to publish"
        />

        <p className="text-xs text-muted-foreground text-center">
          Mention your platform (LinkedIn, Substack), topics, and any style influences.
        </p>

        <div className="flex justify-center">
          <Button
            onClick={handleSubmit}
            disabled={loading || input.trim().length < 10}
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 ease-out px-8"
          >
            {loading ? 'Setting up...' : "Let's go →"}
          </Button>
        </div>
      </div>
    </div>
  );
}
