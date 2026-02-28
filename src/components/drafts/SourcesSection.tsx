import { Badge } from '@/components/ui/badge';
import type { ResearchSource } from '@/db/schema';

interface SourcesSectionProps {
  sources: ResearchSource[];
}

export function SourcesSection({ sources }: SourcesSectionProps) {
  return (
    <details className="group">
      <summary className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2 cursor-pointer list-none flex items-center gap-2">
        <span>Sources ({sources.length})</span>
        <span className="group-open:rotate-180 transition-transform text-[10px]">&#x25BE;</span>
      </summary>
      <div className="flex flex-col gap-1.5 mt-2">
        {sources.map((src, i) => {
          // Guard against javascript: URLs stored in DB research sources
          const safeUrl =
            src.url?.startsWith('http://') || src.url?.startsWith('https://')
              ? src.url
              : '#';
          return (
            <div key={i} className="flex items-start gap-2">
              <Badge
                className="shrink-0 mt-0.5 border text-[10px] font-mono capitalize bg-secondary text-muted-foreground border-border"
                variant="outline"
              >
                {src.source}
              </Badge>
              <div className="min-w-0">
                <a
                  href={safeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline truncate block"
                >
                  {src.title || src.url}
                </a>
                {src.summary && (
                  <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-2">
                    {src.summary}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
