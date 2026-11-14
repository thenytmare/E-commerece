'use server';

import { cache } from 'react';
import { createRepositories } from '@repo/database';
import { requirePermission } from '@/lib/actions/auth';
import { toNumber } from '@/lib/format';

/**
 * Per-request caches for the dashboard's shared datasets.
 *
 * The dashboard renders several widgets simultaneously, and each used to call
 * these uncapped queries independently — scanning the whole orders table three
 * times and the products table twice on every load. `cache()` dedupes them
 * within a request without changing any caller's shape.
 */
const cachedOrderAnalytics = cache(() => createRepositories().order.listAllForAnalytics());
const cachedProductAnalytics = cache(() => createRepositories().product.findAllForAnalytics());
const cachedLowStock = cache(() => createRepositories().inventory.findLowStockDetailed());
const cachedRecentOrders = cache((limit: number) => createRepositories().order.listAll(limit));


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

export type DashboardOverviewResponse = {
  orders: number;
  customers: number;
  products: number;
  refunds: number;
  paidOrders: number;
  visitors: number;
  conversionRate: number;
  profit: number;
};

export type DashboardNotification = {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'inventory';
  priority: 'high' | 'normal';
  read: boolean;
  createdAt: string;
  link: string;
};

export type RecentDashboardData = {
  orders: { id: string; orderNumber: string; customer: string; total: number; status: string; createdAt: string }[];
  customers: { id: string; name: string; email: string; lastOrderAt: string }[];
};

export async function getRecentDashboardData(): Promise<RecentDashboardData> {
  await requirePermission('analytics.read');
  const orders = await cachedRecentOrders(20);
  const customers = new Map<string, RecentDashboardData['customers'][number]>();

  for (const order of orders) {
    if (!order.userId || customers.has(order.userId)) continue;
    customers.set(order.userId, {
      id: order.userId,
      name: order.user?.name ?? 'Guest customer',
      email: order.user?.email ?? 'No email address',
      lastOrderAt: order.createdAt.toISOString(),
    });
  }

  return {
    orders: orders.slice(0, 5).map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customer: order.user?.name ?? order.user?.email ?? 'Guest customer',
      total: toNumber(order.total),
      status: order.status,
      createdAt: order.createdAt.toISOString(),
    })),
    customers: Array.from(customers.values()).slice(0, 5),
  };
}

export async function getDashboardNotifications(): Promise<DashboardNotification[]> {
  await requirePermission('analytics.read');
  const repos = createRepositories();
  const [orders, lowStock] = await Promise.all([
    cachedRecentOrders(5),
    cachedLowStock(),
  ]);

  return [
    ...orders.map((order) => ({
      id: `order-${order.id}`,
      title: `Order ${order.orderNumber}`,
      message: `${order.items.length} item${order.items.length === 1 ? '' : 's'} awaiting review`,
      type: 'order' as const,
      priority: 'normal' as const,
      read: false,
      createdAt: order.createdAt.toISOString(),
      link: '/admin/orders',
    })),
    ...lowStock.slice(0, 5).map((item) => ({
      id: `inventory-${item.id}`,
      title: 'Low stock alert',
      message: `${item.variant.product.name} has ${item.quantity - item.reserved} available`,
      type: 'inventory' as const,
      priority: 'high' as const,
      read: false,
      createdAt: new Date().toISOString(),
      link: '/admin/inventory',
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getDashboardOverview(): Promise<DashboardOverviewResponse> {
  await requirePermission('analytics.read');
  const repos = createRepositories();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const [orders, products, productCount, traffic] = await Promise.all([
    cachedOrderAnalytics(),
    cachedProductAnalytics(),
    repos.product.findMany({ limit: 1 }).then((r) => r.total),
    repos.analytics.getTrafficSummary(since),
  ]);
  const customerIds = new Set(orders.map((order) => order.userId).filter(Boolean));

  const costByProduct = new Map(products.map((product) => [product.id, toNumber(product.costPrice)]));
  const paidOrders = orders.filter((order) => order.payments.some((payment) => payment.status === 'COMPLETED'));
  const profit = paidOrders.reduce((total, order) => total + order.items.reduce((orderProfit, item) => orderProfit + ((toNumber(item.price) - (costByProduct.get(item.productId) ?? 0)) * item.quantity), 0), 0);
  return {
    orders: orders.length,
    customers: customerIds.size,
    products: productCount,
    refunds: orders.filter((order) => order.status === 'REFUNDED' || order.payments.some((payment) => payment.status === 'REFUNDED')).length,
    paidOrders: paidOrders.length,
    visitors: traffic.visitors,
    conversionRate: traffic.visitors === 0 ? 0 : Number(((paidOrders.length / traffic.visitors) * 100).toFixed(1)),
    profit,
  };
}

export async function getRevenueDashboard(): Promise<RevenueResponse> {
  await requirePermission('analytics.read');
  const repos = createRepositories();
  const orders = await cachedOrderAnalytics();
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
  await requirePermission('analytics.read');
  const repos = createRepositories();
  const [orders, products] = await Promise.all([
    cachedOrderAnalytics(),
    cachedProductAnalytics(),
  ]);
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
  await requirePermission('analytics.read');
  const repos = createRepositories();
  const lowStock = await cachedLowStock();
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
  await requirePermission('analytics.read');
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
