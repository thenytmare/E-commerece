import { LoginForm } from '@/components/auth/login-form';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { Heading, Text } from '@repo/ui';
import { Suspense } from 'react';

export const metadata = {
  title: 'Sign in',
};

const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export default function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="mb-8 text-center">
        <Heading as="h1" size="lg" className="mb-2">
          Welcome back
        </Heading>
        <Text variant="muted">Sign in to your Prime Accessories Kenya account</Text>
      </div>
      {googleEnabled ? (
        <div className="mb-6 space-y-4">
          <GoogleSignInButton />
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or sign in with email
            <div className="h-px flex-1 bg-border" />
          </div>
        </div>
      ) : null}
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
