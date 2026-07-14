'use server';

import { signIn, signOut } from '@/auth';
import { mergeGuestCartForUser } from '@/lib/cart';
import { registerSchema } from '@/lib/validations/auth';
import { createRepositories } from '@repo/database';
import bcrypt from 'bcryptjs';
import { CredentialsSignin } from 'next-auth';
import { redirect } from 'next/navigation';

const repos = createRepositories();

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function loginAction(
  _prevState: AuthFormState | null,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const callbackUrl = String(formData.get('callbackUrl') ?? '/');

  const existingUser = await repos.user.findByEmail(email);
  if (!existingUser?.passwordHash) {
    return { error: 'Invalid email or password' };
  }

  const passwordValid = await bcrypt.compare(password, existingUser.passwordHash);
  if (!passwordValid) {
    return { error: 'Invalid email or password' };
  }

  await mergeGuestCartForUser(existingUser.id);

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
