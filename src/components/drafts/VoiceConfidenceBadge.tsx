import { Badge } from '@/components/ui/badge';

interface VoiceConfidenceBadgeProps {
  score: number;
}

export function VoiceConfidenceBadge({ score }: VoiceConfidenceBadgeProps) {
  const color =
    score >= 80
      ? 'bg-green-500/15 text-green-400 border-green-500/30'
      : score >= 60
      ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
      : 'bg-red-500/15 text-red-400 border-red-500/30';

  return (
    <Badge className={`border text-xs font-mono shrink-0 ${color}`} variant="outline">
      {score}% voice match
    </Badge>
  );
}
