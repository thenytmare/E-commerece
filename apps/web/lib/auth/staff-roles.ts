/**
 * Plain-English names for the staff roles, shared by the admin pages and the
 * invite email. Safe to import in client components (no database code).
 */
export const STAFF_ROLE_OPTIONS = [
  {
    value: 'ADMIN',
    label: 'Admin',
    description: 'Full access, including store settings, email settings and staff.',
  },
  {
    value: 'MANAGER',
    label: 'Shop manager',
    description: 'Runs products, orders, customers, stock and promotions. Cannot change settings or staff.',
  },
  {
    value: 'SUPPORT',
    label: 'Support staff',
    description: 'Can view orders, customers and products to help customers. Cannot change anything.',
  },
] as const;

export type StaffRoleValue = (typeof STAFF_ROLE_OPTIONS)[number]['value'];

export function staffRoleLabel(role: string): string {
  return STAFF_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}

export function isStaffRoleValue(value: unknown): value is StaffRoleValue {
  return typeof value === 'string' && STAFF_ROLE_OPTIONS.some((option) => option.value === value);
}
