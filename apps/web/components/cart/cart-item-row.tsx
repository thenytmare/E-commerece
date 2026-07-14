'use client';

import { ProductImage } from '@/components/catalog/product-image';
import { removeCartItemAction, updateCartItemAction } from '@/lib/actions/cart';
import { formatPrice } from '@/lib/format';
import type { CartWithItems } from '@repo/database';
import { Button, Text } from '@repo/ui';
import Link from 'next/link';
import { useTransition } from 'react';

type CartItem = CartWithItems['items'][number];

interface CartItemRowProps {
  item: CartItem;
}

function formatVariantAttributes(attributes: unknown): string {
  if (!attributes || typeof attributes !== 'object') {
    return '';
  }
  return Object.entries(attributes as Record<string, string>)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' · ');
}

export function CartItemRow({ item }: CartItemRowProps) {
  const [isPending, startTransition] = useTransition();
  const product = item.variant.product;
  const image = product.images[0];
  const variantLabel = formatVariantAttributes(item.variant.attributes);
  const lineTotal =
    (typeof item.variant.price === 'object' && 'toNumber' in item.variant.price
      ? item.variant.price.toNumber()
      : Number(item.variant.price)) * item.quantity;

  const handleQuantityChange = (quantity: number) => {
    const formData = new FormData();
    formData.set('cartItemId', item.id);
    formData.set('quantity', String(quantity));
    startTransition(async () => {
      await updateCartItemAction(null, formData);
    });
  };

  const handleRemove = () => {
    startTransition(async () => {
      await removeCartItemAction(item.id);
    });
  };

  return (
    <div className="flex flex-col gap-4 border-b border-border py-6 sm:flex-row sm:items-center">
      <Link
        href={`/products/${product.slug}`}
        className="flex flex-1 gap-4"
      >
        <div className="w-24 shrink-0 overflow-hidden rounded-lg border border-border">
          <ProductImage
            src={image?.url}
            alt={image?.alt ?? product.name}
            className="aspect-square"
          />
        </div>
        <div className="min-w-0 space-y-1">
          <Text className="font-medium leading-snug">{product.name}</Text>
          {variantLabel ? (
            <Text variant="muted" className="text-sm">
              {variantLabel}
            </Text>
          ) : null}
          <Text variant="muted" className="text-sm">
            {formatPrice(item.variant.price)} each
          </Text>
        </div>
      </Link>

      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={isPending || item.quantity <= 1}
            onClick={() => handleQuantityChange(item.quantity - 1)}
            aria-label="Decrease quantity"
          >
            −
          </Button>
          <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={isPending}
            onClick={() => handleQuantityChange(item.quantity + 1)}
            aria-label="Increase quantity"
          >
            +
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <Text className="min-w-[5rem] text-right font-semibold">{formatPrice(lineTotal)}</Text>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={handleRemove}
          >
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}
