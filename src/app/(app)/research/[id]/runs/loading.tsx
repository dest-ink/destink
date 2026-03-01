import { Skeleton } from '@/components/ui/skeleton';

export default function RunsLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border shrink-0">
        <Skeleton className="h-5 w-32 mb-2" />
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-20 mt-1" />
      </div>
      <div className="flex-1 p-6 space-y-6">
        {/* Run panel skeleton */}
        <Skeleton className="h-28 w-full rounded-lg" />

        {/* Runs list skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-20 mb-3" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
