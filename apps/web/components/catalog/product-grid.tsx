import { auth } from '@/auth';
import { ProductCard } from '@/components/catalog/product-card';
import { getStoreSettings } from '@/lib/store';
import { createRepositories, type ProductListItem } from '@repo/database';
import { Grid, Text } from '@repo/ui';
import { cache } from 'react';

interface ProductGridProps {
  products: ProductListItem[];
  emptyMessage?: string;
}

/**
 * The signed-in shopper's saved products, looked up once per page even when
 * the page shows several grids (the homepage has three).
 */
const getSavedProductIds = cache(async (): Promise<Set<string>> => {
  const session = await auth();
  if (!session?.user?.id) return new Set();
  try {
    return new Set(await createRepositories().wishlist.listProductIdsForUser(session.user.id));
  } catch {
    // Hearts simply show empty if this fails; the page still works.
    return new Set();
  }
});

/**
 * WhatsApp needs the number with the country code and no leading zero.
 * Accepts what people usually type in Kenya: 0712 345 678, 712345678 or +254 712 345 678.
 */
export function toWhatsAppNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return `254${digits.slice(1)}`;
  if (digits.length === 9 && /^[17]/.test(digits)) return `254${digits}`;
  return digits;
}

export async function ProductGrid({
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

  const [saved, store] = await Promise.all([getSavedProductIds(), getStoreSettings()]);
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://primeaccessorieskenya.store').replace(/\/+$/, '');

  return (
    <Grid cols={4} gap="md">
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          priority={index < 4}
          saved={saved.has(product.id)}
          whatsappNumber={toWhatsAppNumber(store.whatsappNumber)}
          storeName={store.name}
          siteUrl={siteUrl}
        />
      ))}
    </Grid>
  );
}
