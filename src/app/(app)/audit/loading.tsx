import { Skeleton } from '@/components/ui/skeleton';

export default function AuditLoading() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="space-y-1.5 mb-6">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-52" />
      </div>
      {/* Table header */}
      <Skeleton className="h-10 w-full rounded-t-lg" />
      {/* Table rows */}
      <div className="flex flex-col gap-px mt-px">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
