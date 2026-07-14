import { type HTMLAttributes } from 'react';
import { cn } from '@repo/utils';

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  /** Vertical spacing variant */
  spacing?: 'sm' | 'md' | 'lg' | 'xl';
}

const spacingClasses = {
  sm: 'py-8 sm:py-12',
  md: 'py-12 sm:py-16',
  lg: 'py-16 sm:py-24',
  xl: 'py-24 sm:py-32',
} as const;

/**
 * Semantic page section with consistent vertical rhythm.
 */
export function Section({
  className,
  spacing = 'md',
  children,
  ...props
}: SectionProps) {
  return (
    <section className={cn(spacingClasses[spacing], className)} {...props}>
      {children}
    </section>
  );
}
