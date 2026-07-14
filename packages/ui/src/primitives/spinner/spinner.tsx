import { type HTMLAttributes } from 'react';
import { cn } from '@repo/utils';

export interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  /** Accessible label for screen readers */
  label?: string;
  /** Visual size of the spinner */
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'size-4 border-2',
  md: 'size-6 border-2',
  lg: 'size-8 border-[3px]',
} as const;

/**
 * Animated loading indicator for async operations.
 */
export function Spinner({
  className,
  label = 'Loading',
  size = 'md',
  ...props
}: SpinnerProps) {
  return (
    <div
      role="status"
      className={cn('inline-flex items-center justify-center', className)}
      {...props}
    >
      <span className="sr-only">{label}</span>
      <span
        className={cn(
          'animate-spin rounded-full border-primary border-t-transparent',
          sizeClasses[size]
        )}
        aria-hidden="true"
      />
    </div>
  );
}
