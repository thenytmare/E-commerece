import { ProductImage } from '@/components/catalog/product-image';
import { discountPercent, formatPrice, toNumber } from '@/lib/format';
import type { ProductListItem } from '@repo/database';
import { Badge, Text } from '@repo/ui';
import Link from 'next/link';

interface ProductCardProps {
  product: ProductListItem;
  priority?: boolean;
}

export function ProductCard({ product, priority }: ProductCardProps) {
  const defaultVariant = product.variants[0];
  const price = defaultVariant?.price ?? product.basePrice;
  const compareAt = defaultVariant?.compareAtPrice ?? product.compareAtPrice;
  const discount = compareAt ? discountPercent(price, compareAt) : null;
  const featuredImage = product.images[0];

  // Stock status on the card itself, so a shopper doesn't click through only
  // to find the product is sold out.
  const inventory = defaultVariant?.inventory;
  const available = inventory ? inventory.quantity - inventory.reserved : null;
  const isSoldOut = available !== null && available <= 0;
  const isLowStock = available !== null && available > 0 && available <= 5;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-shadow hover:shadow-md"
    >
      <div className="relative">
        <ProductImage
          src={featuredImage?.url}
          alt={featuredImage?.alt ?? product.name}
          priority={priority}
        />
        {isSoldOut ? (
          <span className="absolute left-2 top-2 rounded-md bg-foreground/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-background">
            Sold out
          </span>
        ) : isLowStock ? (
          <span className="absolute left-2 top-2 rounded-md bg-warning px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-warning-foreground">
            Only {available} left
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Text variant="muted" className="text-xs font-medium text-primary">
          {product.brand.name}
        </Text>
        <Text className="line-clamp-2 font-medium leading-snug">{product.name}</Text>
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <Text className="font-semibold">{formatPrice(price)}</Text>
          {compareAt && toNumber(compareAt) > toNumber(price) ? (
            <Text variant="muted" className="text-sm line-through">
              {formatPrice(compareAt)}
            </Text>
          ) : null}
          {discount ? (
            <Badge variant="destructive" className="text-[10px]">
              -{discount}%
            </Badge>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
