'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button, Input, Text } from '@repo/ui';
import { resetPasswordAction, type PasswordResetState } from '@/lib/actions/password-reset';

const initialState: PasswordResetState = {};

export function ResetPasswordForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initialState);

  if (state.success) {
    return (
      <div className="space-y-4 text-center" role="status">
        <Text>Your password has been changed.</Text>
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  if (!token || !email) {
    return (
      <div className="space-y-4 text-center">
        <Text>This reset link is incomplete.</Text>
        <Button asChild variant="outline" size="sm">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="email" value={email} />

      <Input
        name="password"
        type="password"
        label="New password"
        autoComplete="new-password"
        required
        disabled={pending}
        error={state.fieldErrors?.password}
        hint="At least 8 characters"
      />
      <Input
        name="confirmPassword"
        type="password"
        label="Confirm new password"
        autoComplete="new-password"
        required
        disabled={pending}
        error={state.fieldErrors?.confirmPassword}
      />

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" isLoading={pending}>
        Set new password
      </Button>
    </form>
  );
}
