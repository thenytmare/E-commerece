import Link from 'next/link';
import { DashboardWidget } from '@/components/admin/ui/DashboardWidget';
import { getRecentDashboardData } from '@/lib/actions/admin-dashboard';
import { formatPrice } from '@/lib/format';

export default async function RecentOrdersWidget() {
  let error: string | null = null;
  let orders: Awaited<ReturnType<typeof getRecentDashboardData>>['orders'] = [];
  try { orders = (await getRecentDashboardData()).orders; } catch (cause) { console.error('RecentOrdersWidget: Failed to load recent orders', cause); error = cause instanceof Error ? cause.message : 'Failed to load recent orders'; }

  return <DashboardWidget title="Recent orders" icon="activity" requiredPermission="orders.read" error={error} empty={!error && orders.length === 0} emptyMessage="No orders yet" body={<ul className="divide-y divide-border">{orders.map((order) => <li key={order.id} className="flex items-center justify-between gap-3 py-3 text-sm"><div className="min-w-0"><p className="font-medium text-foreground">{order.orderNumber}</p><p className="truncate text-muted-foreground">{order.customer}</p></div><div className="text-right"><p className="font-medium text-foreground">{formatPrice(order.total)}</p><p className="text-xs text-muted-foreground">{order.status.toLowerCase()}</p></div></li>)}</ul>} footer={<Link href="/admin/orders" className="text-sm text-primary hover:underline">View all orders</Link>} />;
}
