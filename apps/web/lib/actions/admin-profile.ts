'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createRepositories, prisma } from '@repo/database';
import { requireAdmin } from './auth';
import { RESET_IDENTIFIER_PREFIX } from '@/lib/auth/reset-tokens';
import { getClientIp } from '@/lib/request-context';
import { rateLimit, retryMessage } from '@/lib/rate-limit';

const repos = createRepositories();

/**
 * The signed-in staff member's own account. Every action here works only on
 * the caller's own id from the session. Nothing in the form can point it at
 * another account.
 */

export type ProfileFormState = {
  success?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const MIN_PASSWORD = 10;

const profileSchema = z.object({
  name: z.string().trim().max(100, 'Keep the name under 100 characters.'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  currentPassword: z.string(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z
      .string()
      .min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters.`)
      .max(200, 'Keep it under 200 characters.'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'The two new passwords do not match.',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'Choose a password that is different from your current one.',
    path: ['newPassword'],
  });

function firstErrors(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return fieldErrors;
}

/**
 * Checks the current password, at most 5 tries per 15 minutes per account,
 * so a session left open on a shared computer can't be used to guess it.
 */
async function checkCurrentPassword(
  userId: string,
  passwordHash: string | null,
  password: string
): Promise<{ ok: true } | { ok: false; state: ProfileFormState }> {
  const limit = await rateLimit(`profile-password:${userId}`, 5, 15 * 60_000);
  if (!limit.allowed) return { ok: false, state: { error: retryMessage(limit.retryAfterSeconds) } };
  if (!passwordHash || !(await bcrypt.compare(password, passwordHash))) {
    return { ok: false, state: { fieldErrors: { currentPassword: 'That is not your current password.' } } };
  }
  return { ok: true };
}

export async function updateProfileAction(
  _prev: ProfileFormState | null,
  formData: FormData
): Promise<ProfileFormState> {
  const session = await requireAdmin();
  const parsed = profileSchema.safeParse({
    name: formData.get('name') ?? '',
    email: formData.get('email') ?? '',
    currentPassword: formData.get('currentPassword') ?? '',
  });
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error.issues) };

  const user = await repos.user.findById(session.user.id);
  if (!user) return { error: 'Your account could not be found. Sign out and back in.' };

  const name = parsed.data.name || null;
  // A change of letter case alone is not a new address. Keep it as saved.
  const emailChanged = parsed.data.email !== user.email.toLowerCase();
  const email = emailChanged ? parsed.data.email : user.email;
  const nameChanged = name !== user.name;

  if (!nameChanged && !emailChanged) return { success: true, message: 'Nothing to change.' };

  if (emailChanged) {
    // Changing the sign-in email is as sensitive as changing the password.
    if (!parsed.data.currentPassword) {
      return { fieldErrors: { currentPassword: 'Enter your current password to change your email.' } };
    }
    const check = await checkCurrentPassword(user.id, user.passwordHash, parsed.data.currentPassword);
    if (!check.ok) return check.state;

    const taken = await repos.user.findByEmailAnyCase(email);
    if (taken && taken.id !== user.id) {
      return { fieldErrors: { email: 'Another account already uses this email.' } };
    }
  }

  try {
    await repos.user.updateProfile(user.id, { name, email });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return { fieldErrors: { email: 'Another account already uses this email.' } };
    }
    console.error('Profile update failed:', error);
    return { error: 'Could not save your profile just now. Please try again.' };
  }

  if (emailChanged) {
    // Reset links sent to the old address stop working.
    await prisma.verificationToken.deleteMany({
      where: { identifier: { in: [`${RESET_IDENTIFIER_PREFIX}${user.email}`, `${RESET_IDENTIFIER_PREFIX}${user.email.toLowerCase()}`] } },
    });
  }

  await repos.auditLog.create({
    actorId: user.id,
    ipAddress: (await getClientIp()) ?? undefined,
    action: 'profile.update',
    entity: 'User',
    entityId: user.id,
    metadata: {
      nameChanged,
      ...(emailChanged ? { emailFrom: user.email, emailTo: email } : {}),
    },
  });

  revalidatePath('/admin', 'layout');
  return {
    success: true,
    message: emailChanged ? `Saved. From now on, sign in with ${email}.` : 'Saved.',
  };
}

export async function changePasswordAction(
  _prev: ProfileFormState | null,
  formData: FormData
): Promise<ProfileFormState> {
  const session = await requireAdmin();
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get('currentPassword') ?? '',
    newPassword: formData.get('newPassword') ?? '',
    confirmPassword: formData.get('confirmPassword') ?? '',
  });
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error.issues) };

  const user = await repos.user.findById(session.user.id);
  if (!user) return { error: 'Your account could not be found. Sign out and back in.' };

  const check = await checkCurrentPassword(user.id, user.passwordHash, parsed.data.currentPassword);
  if (!check.ok) return check.state;

  try {
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      // Any reset link already sent for this account stops working.
      await tx.verificationToken.deleteMany({
        where: { identifier: { in: [`${RESET_IDENTIFIER_PREFIX}${user.email}`, `${RESET_IDENTIFIER_PREFIX}${user.email.toLowerCase()}`] } },
      });
    });
  } catch (error) {
    console.error('Password change failed:', error);
    return { error: 'Could not change your password just now. Please try again.' };
  }

  await repos.auditLog.create({
    actorId: user.id,
    ipAddress: (await getClientIp()) ?? undefined,
    action: 'profile.password_change',
    entity: 'User',
    entityId: user.id,
  });

  return { success: true, message: 'Password changed. Use the new one next time you sign in.' };
}
