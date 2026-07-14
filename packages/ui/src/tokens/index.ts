/**
 * Design token definitions for the TechVault design system.
 * CSS custom properties in globals.css mirror these values.
 */

/** Premium near-black palette for text and surfaces */
export const colors = {
  background: '0 0% 98%',
  foreground: '240 6% 4%',
  card: '0 0% 100%',
  cardForeground: '240 6% 4%',
  muted: '240 5% 96%',
  mutedForeground: '240 4% 46%',
  border: '240 6% 90%',
  input: '240 6% 90%',
  ring: '221 83% 53%',
  primary: '221 83% 53%',
  primaryForeground: '0 0% 100%',
  secondary: '240 5% 96%',
  secondaryForeground: '240 6% 10%',
  accent: '221 83% 53%',
  accentForeground: '0 0% 100%',
  destructive: '0 84% 60%',
  destructiveForeground: '0 0% 100%',
  success: '142 76% 36%',
  successForeground: '0 0% 100%',
} as const;

/** Consistent spacing scale (rem-based) */
export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  '2xl': '3rem',
  '3xl': '4rem',
  '4xl': '6rem',
} as const;

/** Border radius tokens */
export const radius = {
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  full: '9999px',
  default: '0.75rem',
} as const;

/** Layered shadow system for depth without harshness */
export const shadows = {
  soft: '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
  medium: '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
  elevated: '0 10px 15px -3px rgb(0 0 0 / 0.06), 0 4px 6px -4px rgb(0 0 0 / 0.06)',
} as const;

/** Motion durations respecting reduced-motion preferences */
export const motion = {
  fast: '150ms',
  normal: '250ms',
  slow: '350ms',
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

/** Typography scale */
export const typography = {
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
    '5xl': ['3rem', { lineHeight: '1.1' }],
  },
} as const;

export const tokens = {
  colors,
  spacing,
  radius,
  shadows,
  motion,
  typography,
} as const;
