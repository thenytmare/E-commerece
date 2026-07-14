import { type HTMLAttributes } from 'react';
import { cn } from '@repo/utils';

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  /** Maximum width constraint */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const sizeClasses = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-6xl',
  xl: 'max-w-7xl',
  full: 'max-w-full',
} as const;

/**
 * Centers content with consistent horizontal padding and max-width.
 */
export function Container({
  className,
  size = 'xl',
  children,
  ...props
}: ContainerProps) {
  return (
    <div
      className={cn('mx-auto w-full px-4 sm:px-6 lg:px-8', sizeClasses[size], className)}
      {...props}
    >
      {children}
    </div>
  );
}
