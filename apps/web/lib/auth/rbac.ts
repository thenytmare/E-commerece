import type { RoleName } from '@repo/database';

// SUPPORT users have read-only admin capabilities. Individual routes and
// actions still enforce the specific permission they require.
const ADMIN_ROLES: RoleName[] = ['ADMIN', 'MANAGER', 'SUPPORT'];

/** Check whether a user has any of the given roles */
export function hasRole(roles: RoleName[], allowed: RoleName[]): boolean {
  return roles.some((role) => allowed.includes(role));
}

/** Check whether a user can access admin routes */
export function canAccessAdmin(roles: RoleName[]): boolean {
  return hasRole(roles, ADMIN_ROLES);
}
