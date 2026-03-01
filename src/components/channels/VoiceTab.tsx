'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { VoiceWizard } from '@/components/channels/VoiceWizard';

interface VoiceTabProps {
  channelId: string;
  personaPrompt: string | null;
}

export function VoiceTab({ channelId, personaPrompt }: VoiceTabProps) {
  const router = useRouter();
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <div className="space-y-4">
      {personaPrompt ? (
        <>
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-medium text-foreground mb-2">Current Voice</h3>
            <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
              {personaPrompt}
            </pre>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setWizardOpen(true)}
          >
            Retrain Voice
          </Button>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            No voice profile yet. Set up your writing voice so drafts sound like you.
          </p>
          <Button
            size="sm"
            onClick={() => setWizardOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Set Up Voice
          </Button>
        </div>
      )}

      <VoiceWizard
        channelId={channelId}
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onComplete={() => router.refresh()}
      />
    </div>
  );
}
