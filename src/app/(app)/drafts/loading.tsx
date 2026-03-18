import { Skeleton } from '@/components/ui/skeleton';

export default function DraftsLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border shrink-0">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-4 w-36 mt-1.5" />
      </div>
      <div className="flex-1 flex min-h-0">
        {/* Left panel — draft list */}
        <div className="w-64 border-r border-border p-3 flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        {/* Right panel — draft detail */}
        <div className="flex-1 p-6 space-y-4">
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-48 w-full rounded-lg" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
