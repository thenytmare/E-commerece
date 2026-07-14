import { cva, type VariantProps } from 'class-variance-authority';
import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@repo/utils';

const inputVariants = cva(
  'flex w-full rounded-lg border bg-background px-4 py-2 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-input focus-visible:ring-2 focus-visible:ring-ring',
        error: 'border-destructive focus-visible:ring-2 focus-visible:ring-destructive',
      },
      inputSize: {
        sm: 'h-9 text-xs',
        md: 'h-11',
        lg: 'h-12 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      inputSize: 'md',
    },
  }
);

export interface InputProps
  extends InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {
  /** Error message displayed below the input */
  error?: string;
  /** Helper text displayed below the input */
  hint?: string;
  /** Label for the input field */
  label?: string;
}

/**
 * Accessible text input with optional label, hint, and error states.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, inputSize, error, hint, label, id, ...props }, ref) => {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const hasError = Boolean(error);
    const resolvedVariant = hasError ? 'error' : variant;

    return (
      <div className="w-full space-y-2">
        {label ? (
          <label htmlFor={inputId} className="text-sm font-medium text-foreground">
            {label}
          </label>
        ) : null}
        <input
          id={inputId}
          className={cn(inputVariants({ variant: resolvedVariant, inputSize, className }))}
          ref={ref}
          aria-invalid={hasError}
          aria-describedby={
            error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
          }
          {...props}
        />
        {error ? (
          <p id={`${inputId}-error`} className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="text-sm text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { inputVariants };
