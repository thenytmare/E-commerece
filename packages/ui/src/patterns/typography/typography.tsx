import { type HTMLAttributes } from 'react';
import { cn } from '@repo/utils';

type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4';

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: HeadingLevel;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const sizeClasses = {
  xs: 'text-lg font-semibold tracking-tight',
  sm: 'text-xl font-semibold tracking-tight',
  md: 'text-2xl font-semibold tracking-tight sm:text-3xl',
  lg: 'text-3xl font-semibold tracking-tight sm:text-4xl',
  xl: 'text-4xl font-semibold tracking-tight sm:text-5xl',
  '2xl': 'text-5xl font-semibold tracking-tight sm:text-6xl',
} as const;

/**
 * Semantic heading with consistent typography scale.
 */
export function Heading({
  as: Component = 'h2',
  size = 'md',
  className,
  children,
  ...props
}: HeadingProps) {
  return (
    <Component className={cn('text-balance text-foreground', sizeClasses[size], className)} {...props}>
      {children}
    </Component>
  );
}

export interface TextProps extends HTMLAttributes<HTMLParagraphElement> {
  variant?: 'body' | 'lead' | 'small' | 'muted';
}

const textVariants = {
  body: 'text-base leading-relaxed',
  lead: 'text-lg leading-relaxed text-muted-foreground',
  small: 'text-sm leading-normal',
  muted: 'text-sm text-muted-foreground',
} as const;

/**
 * Body text with predefined style variants.
 */
export function Text({
  variant = 'body',
  className,
  children,
  ...props
}: TextProps) {
  return (
    <p className={cn(textVariants[variant], className)} {...props}>
      {children}
    </p>
  );
}
