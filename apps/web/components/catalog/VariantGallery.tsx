'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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

/**
 * Product photos. On a phone, swipe the big photo left and right; dots under
 * it show which photo is showing. On a computer, use the arrows or the
 * thumbnails. Thumbnails work everywhere and follow the swipe.
 */
export function VariantGallery({ images, selectedVariantId, productName }: VariantGalleryProps) {
  // Show images assigned to the selected variant, plus any "general" (unassigned) images.
  const filtered = images
    .filter((img) => img.variantId === selectedVariantId || img.variantId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (filtered.length === 0) {
    return (
      <div className="aspect-square rounded-xl border border-border bg-muted flex items-center justify-center">
        <span className="text-muted-foreground text-sm">No image available</span>
      </div>
    );
  }

  // A different option can have different photos: start again from its first one.
  return <Slides key={selectedVariantId ?? 'all'} images={filtered} productName={productName} />;
}

function Slides({ images, productName }: { images: GalleryImage[]; productName: string }) {
  const track = useRef<HTMLDivElement>(null);
  const startAt = Math.max(0, images.findIndex((img) => img.isFeatured));
  const [index, setIndex] = useState(startAt);
  const count = images.length;

  // Open on the featured photo, without an animated scroll.
  useEffect(() => {
    const el = track.current;
    if (el && startAt > 0) el.scrollLeft = startAt * el.clientWidth;
  }, [startAt]);

  // Which photo is showing, worked out from how far the strip has been swiped.
  const onScroll = () => {
    const el = track.current;
    if (!el || el.clientWidth === 0) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    if (next !== index) setIndex(Math.min(count - 1, Math.max(0, next)));
  };

  const goTo = (target: number) => {
    const el = track.current;
    if (!el) return;
    const clamped = Math.min(count - 1, Math.max(0, target));
    // Glide to the photo, unless the device asks for less motion.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: clamped * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
    setIndex(clamped);
  };

  const arrow =
    'absolute top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-sm transition-opacity hover:bg-card focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex md:opacity-0 md:group-hover:opacity-100';

  return (
    <div>
      <div className="group relative">
        {/* The swipe strip: one photo per screen width, snapping into place. */}
        {/* Keyboard users can tab to the photos and use the left and right arrow keys. */}
        <div
          ref={track}
          onScroll={onScroll}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') {
              event.preventDefault();
              goTo(index + 1);
            } else if (event.key === 'ArrowLeft') {
              event.preventDefault();
              goTo(index - 1);
            }
          }}
          className="flex aspect-square snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-xl border border-border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label={count > 1 ? `${productName} photos. Use the left and right arrow keys to change photo.` : `${productName} photo`}
          role="region"
          aria-roledescription="carousel"
        >
          {images.map((img, i) => (
            <div
              key={img.id}
              className="relative h-full w-full shrink-0 snap-center snap-always bg-muted"
              role="group"
              aria-roledescription="slide"
              aria-label={`Photo ${i + 1} of ${count}`}
              aria-hidden={i !== index}
            >
              <Image
                src={img.url}
                alt={img.alt ?? productName}
                fill
                // Full width on phones and tablets, half the page beside the details on a computer.
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                priority={i === startAt}
                draggable={false}
              />
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            {/* Arrows show on hover on a computer, and only where there is a photo to go to. */}
            {index > 0 && (
              <button type="button" onClick={() => goTo(index - 1)} aria-label="Previous photo" className={`${arrow} left-3`}>
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
            {index < count - 1 && (
              <button type="button" onClick={() => goTo(index + 1)} aria-label="Next photo" className={`${arrow} right-3`}>
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            )}

            {/* Dots: which photo is showing. Phones and tablets only. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5 md:hidden" aria-hidden="true">
              {images.map((img, i) => (
                <span
                  key={img.id}
                  className={`h-1.5 rounded-full shadow-sm transition-all ${
                    i === index ? 'w-4 bg-primary' : 'w-1.5 bg-foreground/30'
                  }`}
                />
              ))}
            </div>
          </>
        )}
        <p className="sr-only" aria-live="polite">
          {count > 1 ? `Photo ${index + 1} of ${count}` : ''}
        </p>
      </div>

      {/* Thumbnails */}
      {count > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Photo ${i + 1} of ${count}${i === index ? ', selected' : ''}`}
              aria-current={i === index}
              className={`relative w-16 h-16 rounded-md border-2 overflow-hidden flex-shrink-0 transition-colors ${
                i === index ? 'border-primary' : 'border-border hover:border-muted-foreground'
              }`}
            >
              <Image src={img.url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
