'use client';

import { loginAction, type AuthFormState } from '@/lib/actions/auth';
import { Button, Input } from '@repo/ui';
import Link from 'next/link';
import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';

const initialState: AuthFormState = {};

/**
 * Messages for the `?error=` values the auth guards redirect with. Without
 * these the user was bounced to a blank sign-in form with no idea why —
 * particularly confusing for `unauthorized`, where signing in again won't help.
 */
const REDIRECT_ERRORS: Record<string, string> = {
  unauthorized: 'You need an administrator account to open that page.',
  forbidden: "Your account doesn't have permission to do that.",
  account_disabled:
    'This account has been deactivated. Please contact support if you think this is a mistake.',
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';
  const redirectError = REDIRECT_ERRORS[searchParams.get('error') ?? ''];
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      {redirectError && !state?.error ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {redirectError}
        </p>
      ) : null}

      <Input
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
        disabled={pending}
      />
      <div>
        <Input
          name="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          required
          disabled={pending}
        />
        <div className="mt-1.5 text-right">
          <Link
            href="/forgot-password"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Forgot your password?
          </Link>
        </div>
      </div>

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
