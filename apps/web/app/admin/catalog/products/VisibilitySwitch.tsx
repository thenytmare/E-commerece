'use client';

import React from 'react';

/**
 * An on/off switch for "customers can see this product".
 *
 * A real `role="switch"` button, so it works with the keyboard (Space and
 * Enter) and screen readers. The word "Visible" or "Hidden" sits beside it, so
 * the state never depends on colour alone. The tap area is at least 44px high.
 */
export function VisibilitySwitch({
  checked,
  productName,
  disabled,
  disabledReason,
  busy,
  onChange,
}: {
  checked: boolean;
  productName: string;
  disabled?: boolean;
  /** Shown as a tooltip when the switch is disabled, for example for read-only roles. */
  disabledReason?: string;
  /** True while this row's request is running. */
  busy?: boolean;
  onChange: (next: boolean) => void;
}) {
  const isDisabled = disabled || busy;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${checked ? 'Hide' : 'Show'} ${productName} on the storefront`}
      aria-busy={busy || undefined}
      disabled={isDisabled}
      title={disabled ? disabledReason : undefined}
      onClick={() => onChange(!checked)}
      className="group inline-flex min-h-[44px] items-center gap-2 rounded-md px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
          checked ? 'border-green-600 bg-green-600' : 'border-border bg-muted'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </span>
      <span className={`text-xs font-medium ${checked ? 'text-green-700' : 'text-muted-foreground'}`}>
        {checked ? 'Visible' : 'Hidden'}
      </span>
    </button>
  );
}
