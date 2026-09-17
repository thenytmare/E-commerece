'use client';

import { ProductImage } from '@/components/catalog/product-image';
import { removeCartItemAction, updateCartItemAction } from '@/lib/actions/cart';
import { formatPrice } from '@/lib/format';
import type { Serialized } from '@/lib/serialize';
import type { CartWithItems } from '@repo/database';
import { Button, Text } from '@repo/ui';
import Link from 'next/link';
import { useState, useTransition } from 'react';

type CartItem = Serialized<CartWithItems['items'][number]>;

interface CartItemRowProps {
  item: CartItem;
  /**
   * Price actually charged for one unit, with any active flash sale applied.
   * Resolved on the server so the cart shows what checkout will charge.
   */
  unitPrice: number;
}

function formatVariantAttributes(attributes: unknown): string {
  if (!attributes || typeof attributes !== 'object') {
    return '';
  }
  return Object.entries(attributes as Record<string, string>)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' · ');
}

export function CartItemRow({ item, unitPrice }: CartItemRowProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const product = item.variant.product;
  const image = product.images[0];
  const variantLabel = formatVariantAttributes(item.variant.attributes);
  const lineTotal = unitPrice * item.quantity;
  const isDiscounted = unitPrice < item.variant.price;

  // Stock left for this variant. The server is still the authority — this just
  // stops the stepper offering a quantity that's guaranteed to be rejected.
  const available = item.variant.inventory
    ? item.variant.inventory.quantity - item.variant.inventory.reserved
    : null;
  const atStockLimit = available !== null && item.quantity >= available;

  const handleQuantityChange = (quantity: number) => {
    const formData = new FormData();
    formData.set('cartItemId', item.id);
    formData.set('quantity', String(quantity));
    startTransition(async () => {
      // Previously the result was discarded, so a rejected update looked like
      // nothing happened at all — the quantity simply didn't move.
      const result = await updateCartItemAction(null, formData);
      setError(result?.error ?? null);
    });
  };

  const handleRemove = () => {
    startTransition(async () => {
      const result = await removeCartItemAction(item.id);
      setError(result?.error ?? null);
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
            {isDiscounted ? (
              <>
                <span className="mr-1.5 line-through">{formatPrice(item.variant.price)}</span>
                <span className="font-medium text-foreground">{formatPrice(unitPrice)}</span> each
              </>
            ) : (
              <>{formatPrice(unitPrice)} each</>
            )}
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
            disabled={isPending || atStockLimit}
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

      {atStockLimit && !error ? (
        <Text variant="muted" className="text-sm sm:text-right">
          {available === 0 ? 'Out of stock' : `Only ${available} left in stock`}
        </Text>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive sm:text-right" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
