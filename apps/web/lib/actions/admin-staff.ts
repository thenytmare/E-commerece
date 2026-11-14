'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createRepositories, enqueueJob, prisma, type Prisma, type SetStaffRoleResult } from '@repo/database';
import { requirePermission } from './auth';
import { RESET_IDENTIFIER_PREFIX, hashResetToken, newResetLink } from '@/lib/auth/reset-tokens';
import { isStaffRoleValue, staffRoleLabel, type StaffRoleValue } from '@/lib/auth/staff-roles';
import { STAFF_INVITE_EMAIL_JOB } from '@/lib/jobs/types';
import { isMailConfigured } from '@/lib/mail';
import { getClientIp } from '@/lib/request-context';
import { rateLimit, retryMessage } from '@/lib/rate-limit';

const repos = createRepositories();

/**
 * Staff and roles. Admins only (staff.manage).
 *
 * Rules that always hold:
 * - Nobody changes or removes their own access here, so an admin can't lock
 *   themselves out by mistake.
 * - The shop always keeps at least one admin who can sign in (enforced in the
 *   database transaction, see UserRepository.setStaffRole).
 * - Every change is written to the activity log.
 */

/** How long an invite link lasts. Longer than a reset link, as people may not check email at once. */
const INVITE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export type StaffFormState = {
  success?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export type StaffActionResult = { success: boolean; message: string };

const addSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  name: z.string().trim().max(100, 'Keep the name under 100 characters.'),
  role: z.string().refine(isStaffRoleValue, 'Choose a role.'),
});

const RESULT_MESSAGES: Record<Exclude<SetStaffRoleResult, 'ok'>, string> = {
  unchanged: 'Nothing changed. They already have that access.',
  not_found: 'That account no longer exists.',
  unavailable: 'That account is archived or switched off. Restore it on the Customers page first.',
  last_admin: 'The shop must keep at least one admin who can sign in. Make someone else an admin first.',
};

async function log(actorId: string, action: string, entityId: string, metadata: Record<string, string | boolean | null>) {
  await repos.auditLog.create({
    actorId,
    ipAddress: (await getClientIp()) ?? undefined,
    action,
    entity: 'User',
    entityId,
    metadata,
  });
}

/** Two admins changing staff at the same instant: the database refuses one. */
function isConflict(error: unknown): boolean {
  return (error as { code?: string }).code === 'P2034';
}

function refresh() {
  revalidatePath('/admin/settings/staff');
  revalidatePath('/admin/customers');
}

/** Save a new invite token and queue the email, in one transaction. */
async function sendInvite(
  tx: Prisma.TransactionClient,
  email: string,
  role: StaffRoleValue
) {
  const identifier = `${RESET_IDENTIFIER_PREFIX}${email}`;
  const { token, url } = newResetLink(email);
  await tx.verificationToken.deleteMany({ where: { identifier } });
  await tx.verificationToken.create({
    data: { identifier, token: hashResetToken(token), expires: new Date(Date.now() + INVITE_TTL_MS) },
  });
  await enqueueJob(tx, {
    type: STAFF_INVITE_EMAIL_JOB,
    payload: { to: email, setPasswordUrl: url, roleLabel: staffRoleLabel(role) },
    maxAttempts: 5,
  });
}

function mailNote(): string {
  return isMailConfigured()
    ? ''
    : ' Email is not set up yet, so the invite will not arrive. Set up email on the Background Jobs page, then send the invite again.';
}

export async function addStaffAction(_prev: StaffFormState | null, formData: FormData): Promise<StaffFormState> {
  const session = await requirePermission('staff.manage');

  const limit = await rateLimit(`staff-add:${session.user.id}`, 20, 60 * 60_000);
  if (!limit.allowed) return { error: retryMessage(limit.retryAfterSeconds) };

  const parsed = addSchema.safeParse({
    email: formData.get('email') ?? '',
    name: formData.get('name') ?? '',
    role: formData.get('role') ?? '',
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string' && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { fieldErrors };
  }
  const { email, name } = parsed.data;
  const role = parsed.data.role as StaffRoleValue;
  const label = staffRoleLabel(role);

  try {
    const existing = await repos.user.findByEmailAnyCase(email);

    if (existing) {
      if (existing.id === session.user.id) {
        return { fieldErrors: { email: 'That is your own account. You cannot change your own role.' } };
      }
      const result = await repos.user.setStaffRole(existing.id, role);
      if (result !== 'ok') return { error: RESULT_MESSAGES[result] };

      const from = existing.roles.map((entry) => entry.role.name).join(', ') || 'none';
      await log(session.user.id, 'staff.role_change', existing.id, { email: existing.email, from, to: role });
      refresh();
      return {
        success: true,
        message: existing.passwordHash
          ? `${existing.email} is now ${label}. They keep their own password. The new access applies on their next page load.`
          : `${existing.email} is now ${label}. They have not chosen a password yet, so use "Send invite again".`,
      };
    }

    // No account yet: create one with no password and email them a link to
    // choose it. Until they do, nobody can sign in to this account.
    const user = await prisma.$transaction(async (tx) => {
      const roleRow = await tx.role.upsert({ where: { name: role }, create: { name: role }, update: {} });
      const created = await tx.user.create({
        data: { email, name: name || null, passwordHash: null, roles: { create: { roleId: roleRow.id } } },
        select: { id: true },
      });
      await sendInvite(tx, email, role);
      return created;
    });

    await log(session.user.id, 'staff.invite', user.id, { email, role });
    refresh();
    return {
      success: true,
      message: `Invite sent to ${email} as ${label}. The link in the email lasts 3 days.${mailNote()}`,
    };
  } catch (error) {
    if (isConflict(error)) return { error: 'Someone else changed staff at the same moment. Try again.' };
    if ((error as { code?: string }).code === 'P2002') {
      return { fieldErrors: { email: 'An account with this email was just created. Refresh the page.' } };
    }
    console.error('Add staff failed:', error);
    return { error: 'Could not add this person just now. Please try again.' };
  }
}

export async function changeStaffRoleAction(userId: string, role: string): Promise<StaffActionResult> {
  const session = await requirePermission('staff.manage');
  if (!isStaffRoleValue(role)) return { success: false, message: 'Choose a role.' };
  if (userId === session.user.id) return { success: false, message: 'You cannot change your own role.' };

  try {
    const target = await repos.user.findById(userId);
    const result = await repos.user.setStaffRole(userId, role);
    if (result !== 'ok') return { success: result === 'unchanged', message: RESULT_MESSAGES[result] };

    const from = target?.roles.map((entry) => entry.role.name).join(', ') || 'none';
    await log(session.user.id, 'staff.role_change', userId, { email: target?.email ?? null, from, to: role });
    refresh();
    return { success: true, message: `${target?.email ?? 'They'} now ${target ? 'has' : 'have'} ${staffRoleLabel(role)} access.` };
  } catch (error) {
    if (isConflict(error)) return { success: false, message: 'Someone else changed staff at the same moment. Try again.' };
    console.error('Change staff role failed:', error);
    return { success: false, message: 'Could not change the role just now. Please try again.' };
  }
}

export async function removeStaffAction(userId: string): Promise<StaffActionResult> {
  const session = await requirePermission('staff.manage');
  if (userId === session.user.id) return { success: false, message: 'You cannot remove your own access.' };

  try {
    const target = await repos.user.findByIdForAdmin(userId);
    if (!target) return { success: false, message: RESULT_MESSAGES.not_found };

    // An invite nobody accepted: no password, no orders. Delete it outright,
    // so the email is free to register or be invited again.
    if (!target.passwordHash && target.orders.length === 0) {
      await prisma.$transaction(async (tx) => {
        await tx.verificationToken.deleteMany({ where: { identifier: `${RESET_IDENTIFIER_PREFIX}${target.email}` } });
        await tx.user.delete({ where: { id: userId } });
      });
      await log(session.user.id, 'staff.invite_cancel', userId, { email: target.email });
      refresh();
      return { success: true, message: `The invite for ${target.email} is cancelled.` };
    }

    const result = await repos.user.setStaffRole(userId, null);
    if (result !== 'ok') return { success: false, message: RESULT_MESSAGES[result] };

    const from = target.roles.map((entry) => entry.role.name).join(', ') || 'none';
    await log(session.user.id, 'staff.remove', userId, { email: target.email, from });
    refresh();
    return {
      success: true,
      message: `${target.email} no longer has admin access. Their account stays, as a customer.`,
    };
  } catch (error) {
    if (isConflict(error)) return { success: false, message: 'Someone else changed staff at the same moment. Try again.' };
    console.error('Remove staff failed:', error);
    return { success: false, message: 'Could not remove access just now. Please try again.' };
  }
}

export async function resendInviteAction(userId: string): Promise<StaffActionResult> {
  const session = await requirePermission('staff.manage');

  const limit = await rateLimit(`staff-invite:${userId}`, 5, 60 * 60_000);
  if (!limit.allowed) return { success: false, message: retryMessage(limit.retryAfterSeconds) };

  try {
    const target = await repos.user.findById(userId);
    const role = target?.roles.map((entry) => entry.role.name).find(isStaffRoleValue);
    if (!target || !role || target.deletedAt || !target.isActive) {
      return { success: false, message: 'This person is not on the staff list any more.' };
    }
    if (target.passwordHash) {
      return { success: false, message: `${target.email} has already chosen a password. They can use Forgot password if needed.` };
    }

    const email = target.email.toLowerCase();
    await prisma.$transaction(async (tx) => sendInvite(tx, email, role));
    await log(session.user.id, 'staff.invite_resend', userId, { email });
    refresh();
    return { success: true, message: `A new invite is on its way to ${email}. Older links no longer work.${mailNote()}` };
  } catch (error) {
    console.error('Resend invite failed:', error);
    return { success: false, message: 'Could not send the invite just now. Please try again.' };
  }
}
