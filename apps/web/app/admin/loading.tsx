import { LoadingSkeleton } from '@/components/admin/ui/LoadingSkeleton';

function WidgetCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-5 space-y-3 ${className}`}>
      <LoadingSkeleton className="h-4 w-24" />
      <LoadingSkeleton className="h-7 w-16" />
      <LoadingSkeleton className="h-3 w-32" />
    </div>
  );
}

/**
 * Shaped like the dashboard's widget grid (stat cards + larger panels)
 * rather than a generic centered spinner — the widgets themselves are
 * permission-dependent and don't need pixel-perfect matching here, just a
 * layout that doesn't visually jump when the real grid mounts.
 */
export default function AdminDashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <LoadingSkeleton className="h-7 w-40" />
        <LoadingSkeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <WidgetCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <WidgetCardSkeleton className="lg:col-span-2 h-64" />
        <WidgetCardSkeleton className="h-64" />
      </div>
    </div>
  );
}
