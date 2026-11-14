'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button, Container, Heading, Text } from '@repo/ui';

/**
 * Root error boundary. Catches unhandled errors from the (storefront) and
 * (auth) route groups, and anywhere else under the app that doesn't define
 * its own error.tsx — admin routes are covered separately by
 * apps/web/app/admin/error.tsx. This still renders inside the root layout
 * (fonts, globals.css), so @repo/ui components are safe to use here; a crash
 * in the root layout itself is handled by global-error.tsx instead.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <Container size="sm" className="flex flex-col items-center py-16 text-center">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" aria-hidden="true" />
        </div>
        <Heading as="h1" size="lg" className="mb-3">
          Something went wrong
        </Heading>
        <Text variant="lead" className="mb-8 max-w-md">
          We hit an unexpected error loading this page. You can try again, or head back to the
          homepage.
        </Text>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" onClick={() => reset()}>
            Try again
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/">Back home</Link>
          </Button>
        </div>
      </Container>
    </div>
  );
}
