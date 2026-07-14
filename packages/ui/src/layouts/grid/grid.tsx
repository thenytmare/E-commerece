import { type HTMLAttributes } from 'react';
import { cn } from '@repo/utils';

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  /** Number of columns at different breakpoints */
  cols?: 1 | 2 | 3 | 4 | 6;
  /** Gap between grid items */
  gap?: 'sm' | 'md' | 'lg';
}

const colClasses = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
} as const;

const gapClasses = {
  sm: 'gap-4',
  md: 'gap-6',
  lg: 'gap-8',
} as const;

/**
 * Responsive CSS grid layout for product listings and content blocks.
 */
export function Grid({ className, cols = 3, gap = 'md', children, ...props }: GridProps) {
  return (
    <div className={cn('grid', colClasses[cols], gapClasses[gap], className)} {...props}>
      {children}
    </div>
  );
}
