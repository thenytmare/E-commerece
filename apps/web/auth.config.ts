import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-compatible Auth.js config used by middleware.
 * Providers and adapter are added in auth.ts.
 * NOTE: keep this file free of Node.js-only imports (e.g. Prisma)
 * so it remains safe for the Edge runtime.
 */
const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

// Fail fast rather than silently signing sessions with a known-public value.
// A hardcoded fallback secret shipped in source would let anyone who has read
// the repo forge session tokens against a deployment missing the env var.
if (!secret) {
  throw new Error(
    'AUTH_SECRET is not set. Generate one with `openssl rand -base64 32` and add it to your environment (see .env.example).'
  );
}

export const authConfig = {
  trustHost: true,
  secret,
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    // Expose roles from the JWT token into the session so the middleware
    // can read them. This runs in the Edge runtime — no DB calls allowed.
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? '';
        session.user.roles = (token.roles as ('ADMIN' | 'MANAGER' | 'SUPPORT' | 'CUSTOMER')[] | undefined) ?? [];
        session.user.disabled = token.disabled === true;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const pathname = nextUrl.pathname;
      const isLoggedIn = Boolean(auth?.user);
      const roles = auth?.user?.roles ?? [];

      // Set by the jwt callback in auth.ts when the account behind this token
      // has been deactivated or soft-deleted since it was issued.
      if (auth?.user?.disabled) {
        return false;
      }

      // /api/admin is covered here as a backstop; each route handler still
      // enforces its own specific permission and returns JSON on failure.
      if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
        return roles.some((role) => role === 'ADMIN' || role === 'MANAGER' || role === 'SUPPORT');
      }

      if (pathname.startsWith('/account')) {
        return isLoggedIn;
      }

      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
