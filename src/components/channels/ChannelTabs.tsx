'use client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OverviewTab } from '@/components/channels/OverviewTab';
import { VoiceTab } from '@/components/channels/VoiceTab';
import type { CostSummary } from '@/components/channels/ChannelCostSummary';

interface LastResearchRun {
  runAt: string;
  topicCount: number;
}

interface ChannelTabsProps {
  channelId: string;
  costSummary: CostSummary;
  personaPrompt: string | null;
  lastResearchRun: LastResearchRun | null;
}

export function ChannelTabs({
  channelId,
  costSummary,
  personaPrompt,
  lastResearchRun,
}: ChannelTabsProps) {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="voice">Voice</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <OverviewTab
          costSummary={costSummary}
          hasVoice={!!personaPrompt}
          lastResearchRun={lastResearchRun}
        />
      </TabsContent>

      <TabsContent value="voice">
        <VoiceTab channelId={channelId} personaPrompt={personaPrompt} />
      </TabsContent>
    </Tabs>
  );
}
