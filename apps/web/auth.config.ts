import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-compatible Auth.js config used by middleware.
 * Providers and adapter are added in auth.ts.
 */
export const authConfig = {
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
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
