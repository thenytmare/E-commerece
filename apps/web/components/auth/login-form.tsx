'use client';

import { loginAction, type AuthFormState } from '@/lib/actions/auth';
import { Button, Input } from '@repo/ui';
import Link from 'next/link';
import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';

const initialState: AuthFormState = {};

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <Input
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
        disabled={pending}
      />
      <Input
        name="password"
        type="password"
        label="Password"
        autoComplete="current-password"
        required
        disabled={pending}
      />

      {state?.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" isLoading={pending}>
        Sign in
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}
