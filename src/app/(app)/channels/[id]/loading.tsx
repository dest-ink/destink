import { Skeleton } from '@/components/ui/skeleton';

export default function ChannelDetailLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border shrink-0">
        <Skeleton className="h-5 w-32 mb-2" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <div className="flex-1 p-6">
        <Skeleton className="h-10 w-52 mb-6" />
        <Skeleton className="h-40 w-full rounded-lg mb-4" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    </div>
  );
}
