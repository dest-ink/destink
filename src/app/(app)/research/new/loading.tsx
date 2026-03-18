import { Skeleton } from '@/components/ui/skeleton';

export default function NewResearcherLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border shrink-0">
        <Skeleton className="h-5 w-28 mb-2" />
        <Skeleton className="h-6 w-36" />
      </div>
      <div className="flex-1 p-6 space-y-6">
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
    </div>
  );
}
