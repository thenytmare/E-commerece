import { LoadingSkeleton } from '@/components/admin/ui/LoadingSkeleton';
import { Grid } from '@repo/ui';

/** Matches ProductCard's shape: image, brand line, title line, price line. */
function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft">
      <LoadingSkeleton className="aspect-square w-full rounded-none" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <LoadingSkeleton className="h-3 w-16" />
        <LoadingSkeleton className="h-4 w-full" />
        <LoadingSkeleton className="h-4 w-2/3" />
        <LoadingSkeleton className="mt-auto h-5 w-20" />
      </div>
    </div>
  );
}

/** Placeholder for ProductGrid while the catalog query is in flight. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <Grid cols={4} gap="md">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </Grid>
  );
}
