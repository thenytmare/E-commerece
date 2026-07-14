'use client';

import { registerAction, type AuthFormState } from '@/lib/actions/auth';
import { Button, Input } from '@repo/ui';
import Link from 'next/link';
import { useActionState } from 'react';

const initialState: AuthFormState = {};

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <Input
        name="name"
        type="text"
        label="Full name"
        autoComplete="name"
        required
        disabled={pending}
        error={state?.fieldErrors?.name}
      />
      <Input
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
        disabled={pending}
        error={state?.fieldErrors?.email}
      />
      <Input
        name="password"
        type="password"
        label="Password"
        autoComplete="new-password"
        required
        disabled={pending}
        hint="At least 8 characters"
        error={state?.fieldErrors?.password}
      />
      <Input
        name="confirmPassword"
        type="password"
        label="Confirm password"
        autoComplete="new-password"
        required
        disabled={pending}
        error={state?.fieldErrors?.confirmPassword}
      />

      {state?.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" isLoading={pending}>
        Create account
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
