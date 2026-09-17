import { Star } from 'lucide-react';

/**
 * Read-only star rating.
 *
 * Renders as text for assistive tech rather than five unlabelled icons.
 */
export function StarRating({
  value,
  size = 'sm',
  className = '',
}: {
  value: number;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const dimension = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  const rounded = Math.round(value);

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className}`}
      role="img"
      aria-label={`${value.toFixed(1)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={`${dimension} ${
            star <= rounded ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/40'
          }`}
        />
      ))}
    </span>
  );
}
