import { LoginForm } from '@/components/auth/login-form';
import { Heading, Text } from '@repo/ui';
import { Suspense } from 'react';

export const metadata = {
  title: 'Sign in',
};

export default function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="mb-8 text-center">
        <Heading as="h1" size="lg" className="mb-2">
          Welcome back
        </Heading>
        <Text variant="muted">Sign in to your TechVault account</Text>
      </div>
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
