'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const STEPS = [
  { question: 'Describe your writing style in 3 words', placeholder: 'e.g. direct, analytical, warm' },
  { question: 'What contrarian belief do you hold?', placeholder: "Something you believe that most people don't..." },
  { question: 'What topics do you want to avoid?', placeholder: 'e.g. cryptocurrency, celebrity drama, politics' },
  { question: 'Which writers do you admire and why?', placeholder: 'e.g. Paul Graham for clarity, Morgan Housel for storytelling...' },
  { question: 'Describe your ideal reader', placeholder: 'e.g. A senior engineer at a growth-stage startup who reads during lunch...' },
];

const EMPTY_ANSWERS = () => Array(STEPS.length).fill('') as string[];

interface VoiceWizardProps {
  channelId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function VoiceWizard({ channelId, open, onOpenChange, onComplete }: VoiceWizardProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(EMPTY_ANSWERS());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // Defer state reset until after the close animation finishes
  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setTimeout(() => {
        setStep(0);
        setAnswers(EMPTY_ANSWERS());
        setError('');
      }, 200);
    }
  };

  const handleNext = () => {
    if (isLast) {
      handleSubmit();
    } else {
      setStep(s => s + 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const wizardAnswers = STEPS.map((s, i) => ({
        question: s.question,
        answer: answers[i],
      }));
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, method: 'wizard', wizardAnswers }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || 'Failed to save voice profile');
        return;
      }
      onComplete();
      onOpenChange(false);
    } catch (e) {
      console.error('[VoiceWizard] submit failed:', e);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-primary' : 'bg-border'
                }`}
              />
            ))}
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </p>
          <DialogTitle className="text-base font-medium mt-2">{current.question}</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <Textarea
            placeholder={current.placeholder}
            value={answers[step]}
            onChange={e => {
              const next = [...answers];
              next[step] = e.target.value;
              setAnswers(next);
            }}
            className="min-h-[120px] bg-background border-border resize-none font-sans text-sm"
            autoFocus
          />
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          {step > 0 && (
            <Button
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={() => setStep(s => s - 1)}
            >
              Back
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleNext}
            disabled={loading}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading ? 'Saving...' : isLast ? 'Finish' : 'Next →'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
