'use server';

import { signIn, signOut } from '@/auth';
import { mergeGuestCartForUser } from '@/lib/cart';
import { registerSchema } from '@/lib/validations/auth';
import { createRepositories } from '@repo/database';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { CredentialsSignin } from 'next-auth';
import { redirect } from 'next/navigation';
import { hasPermission, type Permission } from '@/lib/auth/permissions';
import type { RoleName } from '@repo/database';

const repos = createRepositories();

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function databaseUnavailableMessage(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return 'Database is unavailable. Start Docker Desktop, then run pnpm docker:up and try again.';
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P1001') {
    return 'Database is unavailable. Start Docker Desktop, then run pnpm docker:up and try again.';
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Can't reach database server")) {
    return 'Database is unavailable. Start Docker Desktop, then run pnpm docker:up and try again.';
  }
  return null;
}

export async function loginAction(
  _prevState: AuthFormState | null,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const callbackUrl = String(formData.get('callbackUrl') ?? '/');

  let existingUser;
  try {
    existingUser = await repos.user.findByEmail(email);
  } catch (error) {
    const dbError = databaseUnavailableMessage(error);
    if (dbError) return { error: dbError };
    throw error;
  }

  if (!existingUser?.passwordHash) {
    return { error: 'Invalid email or password' };
  }

  const passwordValid = await bcrypt.compare(password, existingUser.passwordHash);
  if (!passwordValid) {
    return { error: 'Invalid email or password' };
  }

  try {
    await mergeGuestCartForUser(existingUser.id);
  } catch (error) {
    const dbError = databaseUnavailableMessage(error);
    if (dbError) return { error: dbError };
    throw error;
  }

  try {
    await signIn('credentials', {
      email,
      password,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      return { error: 'Invalid email or password' };
    }
    const dbError = databaseUnavailableMessage(error);
    if (dbError) return { error: dbError };
    throw error;
  }

  return {};
}

export async function registerAction(
  _prevState: AuthFormState | null,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string' && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return { fieldErrors };
  }

  try {
    const existing = await repos.user.findByEmail(parsed.data.email);
    if (existing) {
      return { error: 'An account with this email already exists' };
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const newUser = await repos.user.createWithPassword({
      email: parsed.data.email,
      passwordHash,
      name: parsed.data.name,
    });

    await mergeGuestCartForUser(newUser.id);
  } catch (error) {
    const dbError = databaseUnavailableMessage(error);
    if (dbError) return { error: dbError };
    throw error;
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: '/account',
    });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      return { error: 'Account created but sign-in failed. Please log in.' };
    }
    const dbError = databaseUnavailableMessage(error);
    if (dbError) return { error: dbError };
    throw error;
  }

  return {};
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: '/' });
}

export async function requireAuth(redirectTo = '/login') {
  const { auth } = await import('@/auth');
  const session = await auth();
  if (!session?.user) {
    redirect(redirectTo);
  }
  return session;
}

export async function requireAdmin() {
  const { auth } = await import('@/auth');
  const { canAccessAdmin } = await import('@/lib/auth/rbac');
  const session = await auth();
  if (!session?.user || !canAccessAdmin(session.user.roles)) {
    redirect('/login?error=unauthorized');
  }
  return session;
}

/** Enforce a capability at the server-action boundary. */
export async function requirePermission(permission: Permission) {
  const session = await requireAdmin();
  const roles = (session.user.roles as RoleName[] | undefined) ?? [];
  if (!hasPermission(roles, permission)) {
    redirect('/admin?error=forbidden');
  }
  return session;
}
