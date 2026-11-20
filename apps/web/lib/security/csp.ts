/**
 * Builds the app's Content-Security-Policy header value for one request,
 * parameterised by a per-request `nonce` for `script-src`.
 *
 * This used to be a static header set in `next.config.ts`, but a nonce has
 * to be freshly generated per request, which a static config file can't do
 * — so it now lives here and is only called from `middleware.ts`, which
 * generates the nonce and sets this as both a request header (so Next.js
 * can read the nonce for its own injected inline scripts — see
 * `middleware.ts` for details) and the actual response header.
 *
 * `'unsafe-inline'` is kept alongside the nonce/`strict-dynamic` sources
 * deliberately, as a fallback: per the CSP Level 3 spec, a browser new
 * enough to support nonces/`strict-dynamic` ignores `unsafe-inline` when
 * both are present in the same directive, so this only weakens the policy
 * for browsers that don't understand nonces in the first place (which would
 * otherwise be left with no `script-src` protection at all rather than
 * falling back to the previous, already-`unsafe-inline` behavior).
 */
export function getContentSecurityPolicy(nonce: string): string {
  const sentryDsn = process.env.SENTRY_DSN ?? '';

  // Mirrors the same derivation next.config.ts used to do for its (now
  // removed) static CSP header — see that file's `sentryIngestHost` comment
  // for why this is derived from the DSN instead of hardcoded.
  let sentryIngestHost: string | undefined;
  if (sentryDsn) {
    try {
      sentryIngestHost = new URL(sentryDsn).host;
    } catch {
      // Malformed DSN — leave connect-src untouched; Sentry.init() also warns/no-ops on this.
    }
  }

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src 'self'${sentryIngestHost ? ` https://${sentryIngestHost}` : ''}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}
