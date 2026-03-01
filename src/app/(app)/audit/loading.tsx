import { Skeleton } from '@/components/ui/skeleton';

export default function AuditLoading() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Skeleton className="h-7 w-28 mb-6" />
      {/* Summary cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      {/* Tabs skeleton */}
      <Skeleton className="h-10 w-52 mb-4" />
      {/* Table skeleton */}
      <Skeleton className="h-10 w-full rounded-t-lg" />
      <div className="flex flex-col gap-px mt-px">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
