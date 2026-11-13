import { LoadingSkeleton } from './LoadingSkeleton';

/**
 * Route-level loading state for an admin list page (title + DataTable).
 * Mirrors AdminPage's chrome and DataTable's own internal skeleton-row
 * shape, so nothing visually jumps once the real data replaces it — this
 * only covers the gap DataTable's own loading state can't: the very first
 * navigation into the route, before the table has mounted at all.
 */
export function AdminTablePageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <LoadingSkeleton className="h-7 w-40" />
          <LoadingSkeleton className="h-4 w-56" />
        </div>
        <LoadingSkeleton className="h-9 w-28 rounded-md" />
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border p-4">
          <LoadingSkeleton className="h-9 w-64 rounded-md" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <LoadingSkeleton className="h-4 w-4 shrink-0" />
              <LoadingSkeleton className="h-4 flex-1" />
              <LoadingSkeleton className="h-4 w-20 shrink-0" />
              <LoadingSkeleton className="h-4 w-16 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
