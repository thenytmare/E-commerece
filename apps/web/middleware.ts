import { NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import type { NextAuthRequest } from 'next-auth';
import { authConfig } from './auth.config';
import { getContentSecurityPolicy } from './lib/security/csp';

const { auth } = NextAuth(authConfig);

/**
 * Extends the existing NextAuth middleware — which protects /admin,
 * /account and /api/admin using the `authorized` callback in
 * `auth.config.ts` — with a per-request Content-Security-Policy nonce.
 *
 * The nonce has to be generated here (not in next.config.ts) because it
 * must be a fresh random value on every request; a static config file has
 * no way to do that. See lib/security/csp.ts for the policy itself, and
 * app/layout.tsx for how the nonce reaches Next's own injected scripts.
 *
 * IMPORTANT: wrapping `auth()` with our own function (instead of the
 * previous `export default auth`) changes how NextAuth applies the
 * `authorized` callback. Per next-auth's own middleware implementation
 * (next-auth/lib/index.js `handleAuth`), when no wrapper function is
 * supplied, a `false` result from `authorized` automatically redirects to
 * the sign-in page — but when a wrapper function *is* supplied (as below),
 * that automatic redirect is skipped entirely and the wrapper's return
 * value is used verbatim, regardless of what `authorized` returned. So the
 * redirect is reproduced explicitly below, by calling the *same*
 * `authorized` callback, so the access rules stay defined in exactly one
 * place (auth.config.ts) and this middleware does not change who can reach
 * /admin, /account or /api/admin.
 */
export default auth(async (req: NextAuthRequest) => {
  const nonce = crypto.randomUUID();
  const csp = getContentSecurityPolicy(nonce);

  const isAllowed = await authConfig.callbacks.authorized({ request: req, auth: req.auth });

  if (isAllowed !== true) {
    // Same redirect-to-sign-in behavior next-auth's own middleware performs
    // by default when `authorized` returns false (see the comment above).
    const signInPage = authConfig.pages?.signIn ?? '/login';
    if (req.nextUrl.pathname !== signInPage) {
      const signInUrl = req.nextUrl.clone();
      signInUrl.pathname = signInPage;
      signInUrl.searchParams.set('callbackUrl', req.nextUrl.href);
      const response = NextResponse.redirect(signInUrl);
      response.headers.set('Content-Security-Policy', csp);
      return response;
    }
    // Falls through when the request is already for the sign-in page itself
    // (avoids an infinite redirect loop) — served below with the nonce/CSP
    // like any other allowed request.
  }

  // Re-set the CSP (with this request's nonce) as a *request* header too —
  // this is how Next.js's own request-render pipeline auto-detects the
  // nonce for its injected inline hydration/flight scripts (see
  // next/dist/server/app-render/get-script-nonce-from-header.js, which reads
  // it straight off the incoming `content-security-policy` request header),
  // and how app/layout.tsx reads it via `headers()` for anything of our own.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
});

export const config = {
  // Broadened from the auth-only paths this matcher used to cover, since the
  // CSP nonce now needs to be set on every *page* response — the way the
  // static header in next.config.ts used to apply to '/:path*' before this
  // change. Two carve-outs from that broad page match:
  //  - _next/static, _next/image, favicon.ico and /uploads are excluded:
  //    they're assets, not documents, so there's no inline script for a
  //    nonce to protect, and /uploads keeps the separate, stricter CSP
  //    next.config.ts already sets for it (left alone to avoid the two
  //    colliding).
  //  - `/api` is excluded wholesale, same as it was implicitly before (the
  //    original matcher never touched non-admin API routes either). API
  //    responses are never rendered as HTML, so they don't need the CSP/
  //    nonce this middleware exists to add, and routes like the NextAuth
  //    handler itself (/api/auth/*) and the Stripe/M-Pesa webhooks are
  //    safer left completely unrouted through this auth-aware middleware
  //    rather than risking an interaction with their own request handling.
  // /api/admin/:path* is re-added explicitly afterwards so it keeps exactly
  // the protection it already had.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|uploads).*)', '/api/admin/:path*'],
};
