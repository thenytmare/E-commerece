// Imported from the `/config` subpath (not the package root) since the
// root-level `withSentryConfig` re-export is deprecated in this SDK version
// and removed entirely in v11.
import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';

/**
 * There's a single user-facing SENTRY_DSN var (see .env.example) rather than
 * separate server/client ones. Next.js only inlines NEXT_PUBLIC_-prefixed
 * vars into the browser bundle, so it's republished here under that name for
 * instrumentation-client.ts to read — operators still only set SENTRY_DSN.
 * Left as '' (not undefined) when unset: Sentry's SDK treats an empty DSN
 * the same as no DSN (no-op), and `env` values must be strings.
 */
const sentryDsn = process.env.SENTRY_DSN ?? '';

/**
 * Standalone output is enabled only for Linux/Docker production builds.
 * Windows dev machines often lack symlink permissions required by standalone tracing.
 */
const nextConfig: NextConfig = {
  ...(process.env.STANDALONE_BUILD === 'true' ? { output: 'standalone' as const } : {}),
  transpilePackages: ['@repo/ui', '@repo/utils', '@repo/database', '@repo/config'],
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_SENTRY_DSN: sentryDsn,
  },
  async headers() {
    return [
      {
        // Applies to every route. Content-Security-Policy is deliberately
        // NOT set here: it's now generated per-request in middleware.ts so
        // script-src can carry a fresh nonce (a static config file like this
        // one can't produce a per-request value) — see middleware.ts and
        // lib/security/csp.ts. The headers below don't need to vary per
        // request, so they stay here.
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(self)',
          },
          // Only sent in production — assumes the deployment terminates HTTPS.
          // Sending this over plain HTTP dev would just pollute the browser's HSTS cache.
          ...(process.env.NODE_ENV === 'production'
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
            : []),
        ],
      },
      {
        // Admin-uploaded files are served from this app's own origin. Uploads
        // are already restricted to non-scriptable formats by content sniffing
        // (lib/media/upload-validation.ts); these headers are the second layer,
        // so a file that somehow slips through still can't run as script in a
        // signed-in admin's session.
        source: '/uploads/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Content-Security-Policy', value: "default-src 'none'; img-src 'self'; sandbox" },
        ],
      },
    ];
  },
};

/**
 * Wraps the config with Sentry's build-time plugin (source map generation/
 * upload, request instrumentation). org/project/authToken default to the
 * SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN env vars when omitted here
 * (see the SDK's own SentryBuildOptions type) — none are set in this repo,
 * so without a real Sentry account the plugin just skips the upload step and
 * warns; it does not fail the build. See sentry.server.config.ts,
 * sentry.edge.config.ts and instrumentation-client.ts for the runtime init,
 * and instrumentation.ts for how the server/edge configs get loaded.
 */
export default withSentryConfig(nextConfig, {
  // Silences the plugin's routine build-time logging (source map upload
  // progress, etc.); it still prints warnings/errors, e.g. the expected
  // "no auth token" one when SENTRY_AUTH_TOKEN isn't set.
  silent: true,
  // No Sentry account/org exists for this project yet; opting out avoids a
  // pointless network call to Sentry's telemetry endpoint on every build.
  telemetry: false,
});
