/**
 * Next.js 15 server-startup hook, called once when the server process
 * starts (both for `next dev`/`next start` and inside a serverless cold
 * start). See https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * This file also runs in the edge runtime (e.g. for `middleware.ts`), where
 * Node.js-only checks like env var validation don't apply and some of the
 * globals below aren't available — hence the NEXT_RUNTIME guard.
 *
 * Other startup concerns (e.g. Sentry initialization) may extend this file
 * with further `NEXT_RUNTIME` branches; this hook only owns env validation.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('@/lib/env');
    validateEnv();

    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

/**
 * Forwards errors from nested React Server Components (data fetching,
 * layouts, pages) to Sentry — this is Next.js's own hook for that, separate
 * from `register()` above. Runs on both the nodejs and edge runtimes.
 *
 * No SENTRY_DSN-gating needed here: `Sentry.captureRequestError` just calls
 * into the client `register()` already initialized above, which is the same
 * no-op-without-a-DSN client used everywhere else (see sentry.server.config.ts).
 */
export const onRequestError = async (...args: Parameters<typeof import('@sentry/nextjs').captureRequestError>) => {
  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(...args);
};
