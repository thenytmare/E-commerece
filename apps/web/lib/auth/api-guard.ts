import { NextResponse } from 'next/server';
import type { RoleName } from '@repo/database';
import { canAccessAdmin } from '@/lib/auth/rbac';
import { hasPermission, type Permission } from '@/lib/auth/permissions';

export type ApiGuardResult =
  | { ok: true; userId: string; roles: RoleName[] }
  | { ok: false; response: NextResponse };

/**
 * Permission check for Route Handlers.
 *
 * Server Actions use requirePermission(), which redirects on failure — right
 * for a page navigation, wrong for `fetch()`: the caller receives the login
 * page's HTML where it expected JSON and `res.json()` throws, so a permission
 * problem surfaces as an unrelated parse error. Route handlers get a real
 * 401/403 instead.
 */
export async function guardApi(permission: Permission): Promise<ApiGuardResult> {
  const { auth } = await import('@/auth');
  const session = await auth();

  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'You are not signed in.' }, { status: 401 }),
    };
  }

  const roles = (session.user.roles as RoleName[] | undefined) ?? [];
  if (!canAccessAdmin(roles) || !hasPermission(roles, permission)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'You do not have permission to do that.' },
        { status: 403 }
      ),
    };
  }

  return { ok: true, userId: session.user.id, roles };
}
