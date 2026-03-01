'use client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OverviewTab } from '@/components/channels/OverviewTab';
import { VoiceTab } from '@/components/channels/VoiceTab';
import { ResearchConfigForm } from '@/components/channels/ResearchConfigForm';
import type { CostSummary } from '@/components/channels/ChannelCostSummary';
import type { ResearchConfig } from '@/db/schema';

interface LastResearchRun {
  runAt: string;
  topicCount: number;
}

interface ChannelTabsProps {
  channelId: string;
  costSummary: CostSummary;
  personaPrompt: string | null;
  researchConfig: ResearchConfig | null;
  lastResearchRun: LastResearchRun | null;
}

export function ChannelTabs({
  channelId,
  costSummary,
  personaPrompt,
  researchConfig,
  lastResearchRun,
}: ChannelTabsProps) {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="voice">Voice</TabsTrigger>
        <TabsTrigger value="research">Research Config</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <OverviewTab
          channelId={channelId}
          costSummary={costSummary}
          hasVoice={!!personaPrompt}
          hasResearchConfig={!!researchConfig}
          lastResearchRun={lastResearchRun}
        />
      </TabsContent>

      <TabsContent value="voice">
        <VoiceTab channelId={channelId} personaPrompt={personaPrompt} />
      </TabsContent>

      <TabsContent value="research">
        <ResearchConfigForm channelId={channelId} config={researchConfig} />
      </TabsContent>
    </Tabs>
  );
}
