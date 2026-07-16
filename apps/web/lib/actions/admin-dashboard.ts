'use server';

import { createRepositories } from '@repo/database';
import { requireAdmin } from '@/lib/actions/auth';
import { toNumber } from '@/lib/format';

export type RevenueResponse = {
  totalRevenue: number;
  monthlyTrend: { month: string; revenue: number }[];
};

export type SalesAnalyticsResponse = {
  topProducts: { id: string; name: string; sold: number }[];
  revenueByCategory: { category: string; revenue: number }[];
};

export type LowStockResponse = {
  items: {
    variantId: string;
    productName: string;
    quantity: number;
    reserved: number;
    lowStockThreshold: number;
  }[];
};

export type ActivityFeedResponse = {
  events: {
    id: string;
    type: string;
    actor: string;
    createdAt: string;
    description: string;
  }[];
};

export async function getRevenueDashboard(): Promise<RevenueResponse> {
  await requireAdmin();
  const repos = createRepositories();
  const orders = await repos.order.listAll();
  const totalRevenue = orders.reduce((sum, o) => {
    const completed = o.payments.find((p) => p.status === 'COMPLETED');
    if (!completed) return sum;
    return sum + toNumber(completed.amount);
  }, 0);

  const now = new Date();
  const monthlyTrend: RevenueResponse['monthlyTrend'] = [];
  for (let i = 11; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = monthDate.toLocaleString('default', { month: 'short', year: 'numeric' });
    const monthOrders = orders.filter((o) => {
      const d = new Date(o.createdAt);
      return d.getMonth() === monthDate.getMonth() && d.getFullYear() === monthDate.getFullYear();
    });
    const revenue = monthOrders.reduce((s, o) => {
      const completed = o.payments.find((p) => p.status === 'COMPLETED');
      if (!completed) return s;
      return s + toNumber(completed.amount);
    }, 0);
    monthlyTrend.push({ month: monthKey, revenue });
  }

  return { totalRevenue, monthlyTrend };
}

export async function getSalesAnalyticsDashboard(): Promise<SalesAnalyticsResponse> {
  await requireAdmin();
  const repos = createRepositories();
  const [orders, productsResponse] = await Promise.all([
    repos.order.listAll(),
    repos.product.findMany({ limit: 1000 }),
  ]);
  const products = productsResponse.items;
  const orderItems = orders.flatMap((o) => o.items);

  const productMap = new Map<string, { name: string; sold: number }>();
  for (const item of orderItems) {
    const entry = productMap.get(item.productId) ?? { name: '', sold: 0 };
    entry.sold += item.quantity;
    productMap.set(item.productId, entry);
  }
  for (const p of products) {
    const entry = productMap.get(p.id);
    if (entry) entry.name = p.name;
  }
  const topProducts = Array.from(productMap.entries())
    .map(([id, { name, sold }]) => ({ id, name: name || 'Unknown product', sold }))
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 5);

  const categoryMap = new Map<string, number>();
  for (const item of orderItems) {
    const prod = products.find((p) => p.id === item.productId);
    if (!prod?.category) continue;
    const rev = toNumber(item.price) * item.quantity;
    categoryMap.set(prod.category.name, (categoryMap.get(prod.category.name) ?? 0) + rev);
  }
  const revenueByCategory = Array.from(categoryMap.entries()).map(([category, revenue]) => ({
    category,
    revenue,
  }));

  return { topProducts, revenueByCategory };
}

export async function getLowStockDashboard(): Promise<LowStockResponse> {
  await requireAdmin();
  const repos = createRepositories();
  const lowStock = await repos.inventory.findLowStockDetailed();
  const items = lowStock.map((inv) => ({
    variantId: inv.variantId,
    productName: inv.variant.product?.name ?? '—',
    quantity: inv.quantity,
    reserved: inv.reserved,
    lowStockThreshold: inv.lowStockThreshold,
  }));
  return { items };
}

export async function getActivityFeedDashboard(): Promise<ActivityFeedResponse> {
  await requireAdmin();
  const repos = createRepositories();
  const events = await repos.auditLog.listRecent(20);
  const formatted = events.map((e) => ({
    id: e.id,
    type: e.action,
    actor: e.actor?.email ?? e.actor?.name ?? 'System',
    createdAt: e.createdAt.toISOString(),
    description: `${e.action} on ${e.entity}${e.entityId ? ` (${e.entityId})` : ''}`,
  }));
  return { events: formatted };
}
