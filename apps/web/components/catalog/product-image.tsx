'use client';

import { cn } from '@repo/utils';
import Image from 'next/image';
import { useState } from 'react';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
}

function Placeholder({ alt, className }: { alt: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex aspect-square w-full items-center justify-center bg-gradient-to-br from-muted to-muted/60 text-muted-foreground',
        className
      )}
      aria-label={alt}
    >
      <span className="text-4xl font-semibold opacity-40">{alt.charAt(0).toUpperCase()}</span>
    </div>
  );
}

/**
 * Product image with a styled fallback when the asset is missing or fails to load.
 */
export function ProductImage({ src, alt, className, priority }: ProductImageProps) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return <Placeholder alt={alt} className={className} />;
  }

  return (
    <div className={cn('relative aspect-square w-full overflow-hidden bg-muted', className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        className="object-cover transition-transform duration-300 group-hover:scale-105"
        priority={priority}
        onError={() => setHasError(true)}
      />
    </div>
  );
}
