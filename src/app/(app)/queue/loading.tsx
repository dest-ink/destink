import { Skeleton } from '@/components/ui/skeleton';

export default function QueueLoading() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="space-y-1.5 mb-6">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-4 items-start">
            <Skeleton className="h-10 w-12 shrink-0 rounded" />
            <Skeleton className="h-24 flex-1 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
