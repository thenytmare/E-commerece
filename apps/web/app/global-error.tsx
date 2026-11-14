'use client';

import { useEffect } from 'react';

/**
 * Last-resort error boundary for crashes in the root layout itself (fonts,
 * providers, globals.css). Next.js requires this file to render its own
 * <html>/<body> because it fully replaces the root layout when it triggers.
 * Kept dependency-free (no @repo/ui, no next/link/next/image, no Tailwind
 * classes) since none of that can be trusted to still work in this scenario
 * — inline styles only.
 */
export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          backgroundColor: '#ffffff',
          color: '#111827',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 56,
            height: 56,
            borderRadius: '9999px',
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          !
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 12px' }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.5, color: '#6b7280', maxWidth: 420, margin: '0 0 24px' }}>
          A critical error occurred and this page could not be displayed. Please try again.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: '#111827',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentionally
              plain <a>, not next/link: see the dependency-free rationale above. */}
          <a
            href="/"
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              color: '#111827',
              fontSize: 14,
              fontWeight: 500,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Back home
          </a>
        </div>
      </body>
    </html>
  );
}
