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
import { clientIdentifier, rateLimit, retryMessage } from '@/lib/rate-limit';
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

  const limit = rateLimit(`login:${await clientIdentifier()}`, 10, 5 * 60_000);
  if (!limit.allowed) {
    return { error: retryMessage(limit.retryAfterSeconds) };
  }

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

  // Checked after the password so this message can't be used to probe which
  // addresses have accounts — you need working credentials to ever see it.
  if (!existingUser.isActive || existingUser.deletedAt) {
    return {
      error: 'This account has been deactivated. Please contact support if you think this is a mistake.',
    };
  }

  // A cart-merge failure must never block sign-in. The usual cause is a saved
  // guest-cart line whose stock sold out in the meantime, which would
  // otherwise throw and lock the customer out of their own account.
  try {
    await mergeGuestCartForUser(existingUser.id);
  } catch (error) {
    const dbError = databaseUnavailableMessage(error);
    if (dbError) return { error: dbError };
    console.error('Guest cart merge failed during login:', error);
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

  const limit = rateLimit(`register:${await clientIdentifier()}`, 5, 15 * 60_000);
  if (!limit.allowed) {
    return { error: retryMessage(limit.retryAfterSeconds) };
  }

  let newUserId: string;
  try {
    const existing = await repos.user.findByEmail(parsed.data.email);
    if (existing) {
      return {
        fieldErrors: {
          email: 'An account with this email already exists. Try signing in instead.',
        },
      };
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const newUser = await repos.user.createWithPassword({
      email: parsed.data.email,
      passwordHash,
      name: parsed.data.name,
    });
    newUserId = newUser.id;
  } catch (error) {
    const dbError = databaseUnavailableMessage(error);
    if (dbError) return { error: dbError };
    throw error;
  }

  // Kept outside the block above and non-fatal: the account already exists at
  // this point, so a failed cart merge must not leave the customer with an
  // account they can't finish signing into.
  try {
    await mergeGuestCartForUser(newUserId);
  } catch (error) {
    console.error('Guest cart merge failed during registration:', error);
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
  // Set by the jwt callback when the account was deactivated after this
  // session was issued — see auth.ts.
  if (session.user.disabled) {
    redirect('/login?error=account_disabled');
  }
  return session;
}

export async function requireAdmin() {
  const { auth } = await import('@/auth');
  const { canAccessAdmin } = await import('@/lib/auth/rbac');
  const session = await auth();
  if (!session?.user || session.user.disabled || !canAccessAdmin(session.user.roles)) {
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
