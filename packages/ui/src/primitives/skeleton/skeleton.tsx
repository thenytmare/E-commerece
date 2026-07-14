import { type HTMLAttributes } from 'react';
import { cn } from '@repo/utils';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Shape variant for different loading placeholders */
  variant?: 'default' | 'circular' | 'text';
}

/**
 * Loading placeholder that prevents layout shift during data fetching.
 */
export function Skeleton({ className, variant = 'default', ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-muted',
        variant === 'circular' && 'rounded-full',
        variant === 'text' && 'h-4 rounded',
        variant === 'default' && 'rounded-lg',
        className
      )}
      aria-hidden="true"
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent" />
    </div>
  );
}
