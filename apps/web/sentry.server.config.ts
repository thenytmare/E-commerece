// This file configures the initialization of Sentry on the server (Node.js
// runtime). The config here is used for pages, API routes, Server Actions,
// and Server Components running on Node.js.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  // Left unset (undefined) whenever SENTRY_DSN isn't configured. The SDK's
  // client is still created in that case, but `_isEnabled()` gates on a DSN
  // being present, so every capture call becomes a silent no-op — this is
  // the SDK's own default behavior, not something we implement here. See
  // .env.example for why this var is optional.
  dsn: process.env.SENTRY_DSN,

  integrations: [
    // Feeds the app's existing (and widespread) `console.error(...)` call
    // sites into Sentry as captured events, without requiring any of those
    // call sites to change.
    Sentry.captureConsoleIntegration({ levels: ['error'] }),
  ],

  // Keep at 0 until there's an actual need for performance tracing — this
  // task is scoped to error tracking only.
  tracesSampleRate: 0,

  // Set to true while iterating locally against a real DSN to see SDK
  // internals in the console; keep false otherwise to avoid log noise.
  debug: false,
});
