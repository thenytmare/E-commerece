'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ProductImage } from '@/components/catalog/product-image';

export interface GalleryImage {
  id: string;
  url: string;
  alt: string | null;
  isFeatured: boolean;
  sortOrder: number;
  variantId: string | null;
}

interface VariantGalleryProps {
  images: GalleryImage[];
  selectedVariantId: string | null;
  productName: string;
}

export function VariantGallery({ images, selectedVariantId, productName }: VariantGalleryProps) {
  // Show images assigned to the selected variant, plus any "general" (unassigned) images.
  const filtered = images
    .filter((img) => img.variantId === selectedVariantId || img.variantId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const [activeId, setActiveId] = useState<string | null>(
    filtered.find((img) => img.isFeatured)?.id ?? filtered[0]?.id ?? null
  );

  if (filtered.length === 0) {
    return (
      <div className="aspect-square rounded-xl border border-border bg-muted flex items-center justify-center">
        <span className="text-muted-foreground text-sm">No image available</span>
      </div>
    );
  }

  const active = filtered.find((img) => img.id === activeId) ?? filtered[0]!;

  return (
    <div>
      {/* Main image */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card aspect-square">
        <ProductImage
          src={active.url}
          alt={active.alt ?? productName}
          priority
          className="aspect-square"
        />
      </div>

      {/* Thumbnails */}
      {filtered.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {filtered.map((img, index) => (
            <button
              key={img.id}
              onClick={() => setActiveId(img.id)}
              aria-label={`Photo ${index + 1} of ${filtered.length}${img.id === active.id ? ', selected' : ''}`}
              aria-current={img.id === active.id}
              className={`relative w-16 h-16 rounded-md border-2 overflow-hidden flex-shrink-0 transition-colors ${
                img.id === active.id
                  ? 'border-primary'
                  : 'border-border hover:border-muted-foreground'
              }`}
            >
              <Image
                src={img.url}
                alt=""
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}