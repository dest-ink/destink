import { Skeleton } from '@/components/ui/skeleton';

export default function NewChannelLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border shrink-0">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-64 mt-1.5" />
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
