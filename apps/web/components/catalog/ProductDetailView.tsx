'use client';

import React, { useState } from 'react';
import { VariantGallery } from './VariantGallery';
import { ProductActions } from './ProductActions';
import type { ClientProductDetail } from '@/lib/catalog-dtos';
import { cn } from '@repo/utils';

interface ProductDetailViewProps {
  product: ClientProductDetail;
  whatsappNumber?: string;
  flashSalePrice?: number | null;
  flashSaleEndsAt?: string | null;
  className?: string;
  /** Brand, name and badges, shown above the price beside the photo. */
  heading?: React.ReactNode;
  /** Shown under the buy buttons, such as the Save button. */
  footer?: React.ReactNode;
}

/**
 * Client wrapper that shares selected-variant state between the image
 * gallery and the product actions (price, stock, add-to-cart).
 */
export function ProductDetailView({
  product,
  whatsappNumber,
  flashSalePrice,
  flashSaleEndsAt,
  className,
  heading,
  footer,
}: ProductDetailViewProps) {
  const defaultVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0];
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    defaultVariant?.id ?? null
  );

  return (
    <div className={cn('grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12', className)}>
      {/* Left: variant-aware gallery */}
      <VariantGallery
        key={selectedVariantId ?? 'default'}
        images={product.images}
        selectedVariantId={selectedVariantId}
        productName={product.name}
      />

      {/* Right: name, then price and buy buttons with live variant selection */}
      <div className="min-w-0">
        {heading}
        <ProductActions
          product={product}
          whatsappNumber={whatsappNumber}
          selectedVariantId={selectedVariantId}
          onVariantChange={setSelectedVariantId}
          flashSalePrice={flashSalePrice}
          flashSaleEndsAt={flashSaleEndsAt}
        />
        {footer}
      </div>
    </div>
  );
}
