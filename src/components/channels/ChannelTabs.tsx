'use client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OverviewTab } from '@/components/channels/OverviewTab';
import { VoiceTab } from '@/components/channels/VoiceTab';
import { SettingsTab } from '@/components/channels/SettingsTab';
import type { CostSummary } from '@/components/channels/ChannelCostSummary';

interface LastResearchRun {
  runAt: string;
  topicCount: number;
}

interface ChannelTabsProps {
  channelId: string;
  platform: string;
  channelData: { platformId: string | null; name: string };
  costSummary: CostSummary;
  personaPrompt: string | null;
  lastResearchRun: LastResearchRun | null;
}

export function ChannelTabs({
  channelId,
  platform,
  channelData,
  costSummary,
  personaPrompt,
  lastResearchRun,
}: ChannelTabsProps) {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="voice">Voice</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
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

      <TabsContent value="settings">
        <SettingsTab channelId={channelId} platform={platform} channelData={channelData} />
      </TabsContent>
    </Tabs>
  );
}
