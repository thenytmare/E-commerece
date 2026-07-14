import { ProductCard } from '@/components/catalog/product-card';
import type { ProductListItem } from '@repo/database';
import { Grid, Text } from '@repo/ui';

interface ProductGridProps {
  products: ProductListItem[];
  emptyMessage?: string;
}

export function ProductGrid({
  products,
  emptyMessage = 'No products found. Try adjusting your filters.',
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
        <Text variant="muted">{emptyMessage}</Text>
      </div>
    );
  }

  return (
    <Grid cols={4} gap="md">
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} priority={index < 4} />
      ))}
    </Grid>
  );
}
