'use client';

import { Input, type InputProps } from '@repo/ui';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

/** A password field with a button to show or hide what has been typed. */
export function PasswordInput(props: Omit<InputProps, 'type' | 'endAdornment'>) {
  const [shown, setShown] = useState(false);
  return (
    <Input
      {...props}
      type={shown ? 'text' : 'password'}
      endAdornment={
        <button
          type="button"
          onClick={() => setShown((value) => !value)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          disabled={props.disabled}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {shown ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      }
    />
  );
}
