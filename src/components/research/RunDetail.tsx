import { Badge } from '@/components/ui/badge';
import type { ResearchSource, TopicRecommendation } from '@/db/schema';
import { GenerateDraftsButton } from './GenerateDraftsButton';

const PLATFORM_STYLES: Record<string, { label: string; color: string }> = {
  linkedin: { label: 'LinkedIn', color: 'bg-[#0A66C2]/10 text-[#0A66C2] border-[#0A66C2]/20' },
  substack: { label: 'Substack', color: 'bg-[#FF6719]/10 text-[#FF6719] border-[#FF6719]/20' },
};

const SOURCE_BADGES: Record<string, { label: string; color: string }> = {
  exa: { label: 'Exa', color: 'bg-violet-500/10 text-violet-600 border-violet-500/20' },
  reddit: { label: 'Reddit', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  substack: { label: 'Substack', color: 'bg-[#FF6719]/10 text-[#FF6719] border-[#FF6719]/20' },
  brainstorm: { label: 'Brainstorm', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
};

function scoreColor(score: number): string {
  if (score > 70) return 'bg-green-500/10 text-green-600 border-green-500/20';
  if (score >= 40) return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
  return 'bg-red-500/10 text-red-600 border-red-500/20';
}

interface RunDetailProps {
  run: {
    id: string;
    runAt: string;
    channelName: string;
    platform: string;
    aiModel: string | null;
    sourcesSearched: ResearchSource[] | null;
    topicsFound: TopicRecommendation[] | null;
    draftsGenerated: string[] | null;
    researcherId: string;
  };
}

export function RunDetail({ run }: RunDetailProps) {
  const sources = run.sourcesSearched ?? [];
  const topics = [...(run.topicsFound ?? [])].sort((a, b) => b.relevanceScore - a.relevanceScore);

  const platformStyle = PLATFORM_STYLES[run.platform] ?? {
    label: run.platform,
    color: 'bg-muted text-muted-foreground border-border',
  };

  // Group sources by type
  const sourcesByType = sources.reduce<Record<string, ResearchSource[]>>((acc, s) => {
    const key = s.source;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="border border-border bg-card rounded-lg p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground">
            {new Date(run.runAt).toLocaleDateString()}{' '}
            {new Date(run.runAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <Badge className={`border text-[10px] font-mono ${platformStyle.color}`} variant="outline">
            {run.channelName}
          </Badge>
          {run.aiModel && (
            <Badge className="border text-[10px] font-mono bg-muted text-muted-foreground border-border" variant="outline">
              {run.aiModel}
            </Badge>
          )}
        </div>
        <div className="flex gap-6 mt-3 text-sm text-muted-foreground">
          <span>{sources.length} source{sources.length !== 1 ? 's' : ''} searched</span>
          <span>{topics.length} topic{topics.length !== 1 ? 's' : ''} found</span>
        </div>
        <div className="mt-3 pt-3 border-t border-border/50">
          <GenerateDraftsButton
            runId={run.id}
            researcherId={run.researcherId}
            initialDraftsGenerated={run.draftsGenerated}
          />
        </div>
      </div>

      {/* Topics section */}
      {topics.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-foreground mb-3">Topics</h2>
          <div className="space-y-3">
            {topics.map((topic, i) => (
              <div key={i} className="border border-border bg-card rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-foreground text-sm">{topic.title}</h3>
                      <Badge
                        className={`border text-[10px] font-mono ${scoreColor(topic.relevanceScore)}`}
                        variant="outline"
                      >
                        {topic.relevanceScore}
                      </Badge>
                      <Badge
                        className="border text-[10px] font-mono bg-muted text-muted-foreground border-border"
                        variant="outline"
                      >
                        {topic.contentType}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{topic.angle}</p>
                    {topic.whyTimely && (
                      <p className="text-xs text-muted-foreground/70 italic mt-1">{topic.whyTimely}</p>
                    )}
                  </div>
                </div>

                {/* Topic sources */}
                {topic.sources && topic.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Sources</p>
                    <div className="space-y-1">
                      {topic.sources.map((src, j) => {
                        const srcStyle = SOURCE_BADGES[src.source] ?? {
                          label: src.source,
                          color: 'bg-muted text-muted-foreground border-border',
                        };
                        return (
                          <div key={j} className="flex items-center gap-2 text-xs">
                            <Badge
                              className={`border text-[9px] font-mono shrink-0 ${srcStyle.color}`}
                              variant="outline"
                            >
                              {srcStyle.label}
                            </Badge>
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline truncate"
                            >
                              {src.title || src.url}
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All sources section */}
      {sources.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-foreground mb-3">All Sources</h2>
          <div className="border border-border bg-card rounded-lg divide-y divide-border">
            {Object.entries(sourcesByType).map(([type, typeSources]) => {
              const srcStyle = SOURCE_BADGES[type] ?? {
                label: type,
                color: 'bg-muted text-muted-foreground border-border',
              };

              return (
                <div key={type} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge
                      className={`border text-[10px] font-mono ${srcStyle.color}`}
                      variant="outline"
                    >
                      {srcStyle.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {typeSources.length} source{typeSources.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {typeSources.map((src, j) => (
                      <div key={j} className="text-sm">
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline font-medium"
                        >
                          {src.title || src.url}
                        </a>
                        {src.summary && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {src.summary}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
