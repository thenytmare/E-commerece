// This file configures the initialization of Sentry for the Edge runtime
// (middleware and any route/page that opts into `export const runtime =
// 'edge'`). This is a separate config from sentry.server.config.ts because
// the Edge runtime doesn't support all Node.js APIs the Node SDK relies on.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  // See sentry.server.config.ts: undefined dsn -> the SDK no-ops by design.
  dsn: process.env.SENTRY_DSN,

  integrations: [Sentry.captureConsoleIntegration({ levels: ['error'] })],

  tracesSampleRate: 0,

  debug: false,
});
