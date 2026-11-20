'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button, Input, Text } from '@repo/ui';
import { requestPasswordResetAction, type PasswordResetState } from '@/lib/actions/password-reset';

const initialState: PasswordResetState = {};

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initialState);

  if (state.success) {
    return (
      <div className="space-y-4 text-center" role="status">
        <Text>
          If an account exists for that address, we&apos;ve sent it a link to reset the password.
        </Text>
        <Text variant="muted" className="text-sm">
          The link expires in one hour. Check your spam folder if it doesn&apos;t arrive.
        </Text>
        <Button asChild variant="outline" size="sm">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <Input
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
        disabled={pending}
        error={state.fieldErrors?.email}
      />

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" isLoading={pending}>
        Send reset link
      </Button>

      <Text variant="muted" className="text-center text-sm">
        <Link href="/login" className="underline underline-offset-4">
          Back to sign in
        </Link>
      </Text>
    </form>
  );
}
