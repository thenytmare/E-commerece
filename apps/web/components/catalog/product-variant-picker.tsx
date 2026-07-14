'use client';

import { AddToCartButton } from '@/components/cart/add-to-cart-button';
import { formatPrice, toNumber } from '@/lib/format';
import type { ProductDetail } from '@repo/database';
import { Badge, Text } from '@repo/ui';
import { useMemo, useState } from 'react';

interface ProductVariantPickerProps {
  product: ProductDetail;
}

export function ProductVariantPicker({ product }: ProductVariantPickerProps) {
  const defaultVariant =
    product.variants.find((variant) => variant.isDefault) ?? product.variants[0];

  const [selectedId, setSelectedId] = useState(defaultVariant?.id ?? '');

  const selected = useMemo(
    () => product.variants.find((variant) => variant.id === selectedId) ?? defaultVariant,
    [product.variants, selectedId, defaultVariant]
  );

  if (!selected) {
    return null;
  }

  const available = selected.inventory
    ? selected.inventory.quantity - selected.inventory.reserved
    : 0;
  const isOnSale =
    selected.compareAtPrice && toNumber(selected.compareAtPrice) > toNumber(selected.price);

  const attributeKeys = [
    ...new Set(product.variants.flatMap((variant) => Object.keys(variant.attributes as object))),
  ];

  return (
    <div className="space-y-6">
      {attributeKeys.length > 0 ? (
        <div className="space-y-3">
          {attributeKeys.map((key) => (
            <div key={key}>
              <Text className="mb-2 text-sm font-medium capitalize">{key}</Text>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((variant) => {
                  const attrs = variant.attributes as Record<string, string>;
                  const label = attrs[key];
                  if (!label) {
                    return null;
                  }
                  const isSelected = variant.id === selected.id;
                  return (
                    <button
                      key={`${variant.id}-${key}`}
                      type="button"
                      onClick={() => setSelectedId(variant.id)}
                      className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background hover:bg-muted'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-3">
          <Text className="text-2xl font-semibold">{formatPrice(selected.price)}</Text>
          {isOnSale ? (
            <Text variant="muted" className="text-lg line-through">
              {formatPrice(selected.compareAtPrice!)}
            </Text>
          ) : null}
        </div>
        <Text variant="muted" className="text-sm">
          SKU: {selected.sku}
        </Text>
        {available > 0 ? (
          <Badge variant="success">In stock ({available} available)</Badge>
        ) : (
          <Badge variant="destructive">Out of stock</Badge>
        )}
      </div>

      <AddToCartButton variantId={selected.id} disabled={available <= 0} />
    </div>
  );
}
