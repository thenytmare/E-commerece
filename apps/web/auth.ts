import type { RoleName } from '@repo/database';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { env } from '@repo/config/env';
import { createRepositories, prisma } from '@repo/database';
import bcrypt from 'bcryptjs';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { loginSchema } from './lib/validations/auth';

const repos = createRepositories();

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const user = await repos.user.findByEmail(parsed.data.email);
        if (!user?.passwordHash) {
          return null;
        }

        // Deactivated and soft-deleted accounts must not be able to sign in.
        // Without this, the admin "deactivate"/"archive customer" actions have
        // no effect on authentication and a banned user can simply log back in.
        if (!user.isActive || user.deletedAt) {
          return null;
        }

        const passwordValid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!passwordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      const userId = user?.id ?? token.sub;
      if (!userId) {
        return token;
      }

      let dbUser;
      try {
        dbUser = await repos.user.findById(userId);
      } catch (error) {
        // This callback runs on nearly every page load (it's where sessions
        // are read), so a transient DB error here must not cascade into a
        // sitewide 500. Treat it as "can't verify right now" rather than
        // "revoke access": log it and hand back the token unchanged, keeping
        // whatever roles it already had cached instead of throwing or
        // silently granting/escalating access.
        console.error('jwt callback: failed to look up user for session refresh', error);
        return token;
      }
      token.sub = userId;

      // This callback runs on every session read, not just at sign-in, so it
      // is also where an already-issued session gets revoked: clearing roles
      // and flagging the token drops admin access the moment the account is
      // deactivated, rather than whenever the JWT happens to expire.
      if (!dbUser || !dbUser.isActive || dbUser.deletedAt) {
        token.roles = [];
        token.disabled = true;
        return token;
      }

      token.roles = dbUser.roles.map((entry) => entry.role.name);
      token.disabled = false;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? '';
        session.user.roles = (token.roles as RoleName[] | undefined) ?? [];
        session.user.disabled = token.disabled === true;
      }
      return session;
    },
  },
});
