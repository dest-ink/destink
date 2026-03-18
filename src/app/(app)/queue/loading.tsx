import { Skeleton } from '@/components/ui/skeleton';

export default function QueueLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border shrink-0">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-48 mt-1.5" />
      </div>
      <div className="flex-1 p-6">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4 items-start">
              <Skeleton className="h-10 w-12 shrink-0 rounded" />
              <Skeleton className="h-24 flex-1 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
