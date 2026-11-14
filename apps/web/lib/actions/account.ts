'use server';

import { createRepositories } from '@repo/database';
import { signOut } from '@/auth';
import { requireAuth } from './auth';

const repos = createRepositories();

export type DeleteAccountState = { success: boolean; error?: string };

/**
 * Self-service "delete my account". Only ever acts on the caller's own
 * session (requireAuth, not requirePermission — there is no id parameter to
 * target another user's account).
 *
 * Anonymizes the User row's identity fields and deactivates it, then signs
 * the caller out. Order, Payment, and Address rows are left untouched — see
 * UserRepository.anonymizeAndDeactivate for why.
 */
export async function deleteMyAccountAction(): Promise<DeleteAccountState> {
  const session = await requireAuth();

  try {
    await repos.user.anonymizeAndDeactivate(session.user.id);
  } catch (error) {
    console.error('Failed to delete account:', error);
    return { success: false, error: 'Could not delete your account. Please try again or contact support.' };
  }

  // The account is now deactivated, which the jwt callback in auth.ts already
  // treats as signed-out on the next request/session read — but sign out
  // explicitly here (same as logoutAction) so the cookie is cleared right
  // away instead of waiting on that next request. This redirects, so nothing
  // after this line runs on success.
  await signOut({ redirectTo: '/' });
  return { success: true };
}
