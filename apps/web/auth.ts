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
  secret: env().AUTH_SECRET,
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

      const dbUser = await repos.user.findById(userId);
      token.sub = userId;
      token.roles = dbUser?.roles.map((entry) => entry.role.name) ?? [];
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? '';
        session.user.roles = (token.roles as RoleName[] | undefined) ?? [];
      }
      return session;
    },
  },
});
