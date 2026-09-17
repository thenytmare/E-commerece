'use client';

import { useSession } from 'next-auth/react';
import { useMemo } from 'react';
import { hasPermission, type Permission } from '@/lib/auth/permissions';
import type { RoleName } from '@repo/database';

/**
 * Permission check for client components.
 *
 * This is a UI affordance, never a security boundary — every mutation is still
 * enforced server-side by requirePermission(). Its job is to stop a read-only
 * SUPPORT user being shown Edit/Delete controls that, when clicked, redirect
 * them to the dashboard and throw away whatever they were doing.
 */
export function usePermissions() {
  const { data: session } = useSession();

  return useMemo(() => {
    const roles = (session?.user?.roles as RoleName[] | undefined) ?? [];
    return {
      roles,
      can: (permission: Permission) => hasPermission(roles, permission),
    };
  }, [session]);
}
