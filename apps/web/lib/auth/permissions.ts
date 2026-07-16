import { RoleName } from '@repo/database';

export type Permission = 
  | 'products.read' | 'products.write' | 'products.delete'
  | 'categories.read' | 'categories.write' | 'categories.delete'
  | 'brands.read' | 'brands.write' | 'brands.delete'
  | 'orders.read' | 'orders.write' | 'orders.delete'
  | 'customers.read' | 'customers.write' | 'customers.delete'
  | 'inventory.read' | 'inventory.write'
  | 'analytics.read'
  | 'settings.read' | 'settings.write';

export const RolePermissions: Record<RoleName, Permission[]> = {
  ADMIN: [
    'products.read', 'products.write', 'products.delete',
    'categories.read', 'categories.write', 'categories.delete',
    'brands.read', 'brands.write', 'brands.delete',
    'orders.read', 'orders.write', 'orders.delete',
    'customers.read', 'customers.write', 'customers.delete',
    'inventory.read', 'inventory.write',
    'analytics.read',
    'settings.read', 'settings.write'
  ],
  MANAGER: [
    'products.read', 'products.write',
    'categories.read', 'categories.write',
    'brands.read', 'brands.write',
    'orders.read', 'orders.write',
    'customers.read', 'customers.write',
    'inventory.read', 'inventory.write',
    'analytics.read'
  ],
  CUSTOMER: [],
  SUPPORT: [
    'products.read',
    'categories.read',
    'brands.read',
    'orders.read',
    'customers.read',
    'inventory.read',
    'analytics.read',
    'settings.read'
  ]
};

export function hasPermission(userRoles: RoleName[], permission: Permission): boolean {
  for (const role of userRoles) {
    if (RolePermissions[role]?.includes(permission)) {
      return true;
    }
  }
  return false;
}
