import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-compatible Auth.js config used by middleware.
 * Providers and adapter are added in auth.ts.
 * NOTE: keep this file free of Node.js-only imports (e.g. Prisma)
 * so it remains safe for the Edge runtime.
 */
export const authConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
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
        session.user.roles = (token.roles as ('ADMIN' | 'MANAGER' | 'CUSTOMER')[] | undefined) ?? [];
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const pathname = nextUrl.pathname;
      const isLoggedIn = Boolean(auth?.user);
      const roles = auth?.user?.roles ?? [];

      if (pathname.startsWith('/admin')) {
        return roles.some((role) => role === 'ADMIN' || role === 'MANAGER');
      }

      if (pathname.startsWith('/account')) {
        return isLoggedIn;
      }

      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
