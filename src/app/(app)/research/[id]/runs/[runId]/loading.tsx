import { Skeleton } from '@/components/ui/skeleton';

export default function RunDetailLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border shrink-0">
        <Skeleton className="h-5 w-28 mb-2" />
        <Skeleton className="h-6 w-64" />
      </div>
      <div className="flex-1 p-6 space-y-6">
        {/* Summary card skeleton */}
        <Skeleton className="h-24 w-full rounded-lg" />

        {/* Topic cards skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-16" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>

        {/* Sources skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
