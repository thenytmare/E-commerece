// This file configures the initialization of Sentry on the client (browser).
// Next.js loads this file automatically before any other client-side code —
// it's the App Router convention this SDK version expects in place of the
// older `sentry.client.config.ts`.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  // There's a single user-facing SENTRY_DSN var (see .env.example) — Next.js
  // only inlines NEXT_PUBLIC_-prefixed vars into the browser bundle, so
  // next.config.ts's `env` block republishes SENTRY_DSN under this name
  // rather than asking operators to set the same value twice.
  // Empty/undefined -> the SDK no-ops by design (same as the server/edge
  // configs; an empty string is falsy, same as unset, for this purpose).
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  integrations: [Sentry.captureConsoleIntegration({ levels: ['error'] })],

  tracesSampleRate: 0,

  debug: false,
});

// Required by the SDK to capture App Router navigations as breadcrumbs/spans;
// without it the build prints an "ACTION REQUIRED" warning.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
