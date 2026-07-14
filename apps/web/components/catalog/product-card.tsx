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

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-shadow hover:shadow-md"
    >
      <ProductImage
        src={featuredImage?.url}
        alt={featuredImage?.alt ?? product.name}
        priority={priority}
      />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Text variant="muted" className="text-xs uppercase tracking-wide">
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
