import { DashboardWidget } from '@/components/admin/ui/DashboardWidget';
import { getRecentDashboardData } from '@/lib/actions/admin-dashboard';

export default async function RecentCustomersWidget() {
  let error: string | null = null;
  let customers: Awaited<ReturnType<typeof getRecentDashboardData>>['customers'] = [];
  try { customers = (await getRecentDashboardData()).customers; } catch (cause) { console.error('RecentCustomersWidget: Failed to load recent customers', cause); error = cause instanceof Error ? cause.message : 'Failed to load recent customers'; }

  return <DashboardWidget title="Recent customers" icon="activity" requiredPermission="customers.read" error={error} empty={!error && customers.length === 0} emptyMessage="No customer orders yet" body={<ul className="divide-y divide-border">{customers.map((customer) => <li key={customer.id} className="py-3"><p className="font-medium text-foreground">{customer.name}</p><p className="truncate text-sm text-muted-foreground">{customer.email}</p></li>)}</ul>} />;
}
