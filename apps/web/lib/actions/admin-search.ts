'use server';

import { createRepositories } from '@repo/database';
import { requireAdmin } from './auth';
import { hasPermission, type Permission } from '@/lib/auth/permissions';
import type { RoleName } from '@repo/database';

export type SearchResultKind = 'product' | 'order' | 'customer';

export type AdminSearchResult = {
  id: string;
  kind: SearchResultKind;
  title: string;
  subtitle: string;
  href: string;
};

const LIMIT_PER_KIND = 5;

/**
 * Cross-entity lookup powering the admin command palette. Each entity type
 * is gated on the caller's own permissions, so a SUPPORT user searching
 * never sees results they couldn't open.
 */
export async function adminSearchAction(query: string): Promise<AdminSearchResult[]> {
  const session = await requireAdmin();
  const term = query.trim();
  if (term.length < 2) return [];

  const roles = (session.user.roles as RoleName[] | undefined) ?? [];
  const can = (permission: Permission) => hasPermission(roles, permission);

  const repos = createRepositories();
  const results: AdminSearchResult[] = [];

  const [products, orders, customers] = await Promise.all([
    can('products.read')
      ? repos.product.adminFindMany({ search: term, limit: LIMIT_PER_KIND })
      : Promise.resolve(null),
    can('orders.read')
      ? repos.order.adminFindMany({ search: term, limit: LIMIT_PER_KIND })
      : Promise.resolve(null),
    can('customers.read')
      ? repos.user.adminFindMany({ search: term, limit: LIMIT_PER_KIND })
      : Promise.resolve(null),
  ]);

  if (products) {
    for (const product of products.items) {
      results.push({
        id: product.id,
        kind: 'product',
        title: product.name,
        subtitle: `${product.brand.name} · ${product.category.name}`,
        href: `/admin/catalog/products/${product.id}`,
      });
    }
  }

  if (orders) {
    for (const order of orders.items) {
      results.push({
        id: order.id,
        kind: 'order',
        title: order.orderNumber,
        subtitle: `${order.address?.name ?? 'Guest'} · ${order.status}`,
        href: '/admin/orders',
      });
    }
  }

  if (customers) {
    for (const customer of customers.items) {
      results.push({
        id: customer.id,
        kind: 'customer',
        title: customer.name ?? customer.email,
        subtitle: customer.email,
        href: '/admin/customers',
      });
    }
  }

  return results;
}
