import { RoleName } from '@repo/database';

export type Permission =
  | 'products.read' | 'products.write' | 'products.delete'
  | 'categories.read' | 'categories.write' | 'categories.delete'
  | 'brands.read' | 'brands.write' | 'brands.delete'
  | 'orders.read' | 'orders.write' | 'orders.delete'
  | 'customers.read' | 'customers.write' | 'customers.delete'
  | 'inventory.read' | 'inventory.write'
  | 'media.read' | 'media.write' | 'media.delete'
  | 'marketing.read' | 'marketing.write' | 'marketing.delete'
  | 'reviews.read' | 'reviews.write' | 'reviews.delete'
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
    'media.read', 'media.write', 'media.delete',
    'marketing.read', 'marketing.write', 'marketing.delete',
    'reviews.read', 'reviews.write', 'reviews.delete',
    'analytics.read',
    'settings.read', 'settings.write'
  ],
  // Managers run the catalog day to day, so they own product imagery and
  // promotions outright. They can view store-wide settings (settings.read)
  // for context, but saving them (settings.write) stays ADMIN-only.
  MANAGER: [
    'products.read', 'products.write',
    'categories.read', 'categories.write',
    'brands.read', 'brands.write',
    'orders.read', 'orders.write',
    'customers.read', 'customers.write',
    'inventory.read', 'inventory.write',
    'media.read', 'media.write', 'media.delete',
    'marketing.read', 'marketing.write',
    'reviews.read', 'reviews.write',
    'analytics.read', 'settings.read'
  ],
  CUSTOMER: [],
  // SUPPORT is read-only across the board. Every entry here ends in `.read`;
  // adding a write/delete permission to this list breaks that guarantee.
  SUPPORT: [
    'products.read',
    'categories.read',
    'brands.read',
    'orders.read',
    'customers.read',
    'inventory.read',
    'media.read',
    'marketing.read',
    'reviews.read',
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
