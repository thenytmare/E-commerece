import { getDashboardOverview } from '@/lib/actions/admin-dashboard';
import { DashboardWidget } from '@/components/admin/ui/DashboardWidget';
import { InfoCard } from '@/components/admin/ui/AdminPrimitives';
import { formatPrice } from '@/lib/format';

export default async function StoreOverviewWidget() {
  let error: string | null = null;
  let overview = { orders: 0, customers: 0, products: 0, refunds: 0, paidOrders: 0, visitors: 0, conversionRate: 0, profit: 0 };

  try {
    overview = await getDashboardOverview();
  } catch (cause) {
    console.error('StoreOverviewWidget: Failed to load store overview', cause);
    error = cause instanceof Error ? cause.message : 'Failed to load store overview';
  }

  return (
    <DashboardWidget
      title="Store overview"
      icon="bar-chart"
      requiredPermission="analytics.read"
      error={error}
      body={
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <InfoCard title="Orders" value={overview.orders} description={`${overview.paidOrders} paid`} />
          <InfoCard title="Customers" value={overview.customers} description="Unique purchasers" />
          <InfoCard title="Products" value={overview.products} description="Active catalog records" />
          <InfoCard title="Refunds" value={overview.refunds} description="Orders or payments refunded" />
          <InfoCard title="Visitors" value={overview.visitors} description="Unique visitors in 30 days" />
          <InfoCard title="Conversion" value={`${overview.conversionRate}%`} description="Paid orders per visitor" />
          <InfoCard title="Estimated profit" value={formatPrice(overview.profit)} description="Based on current product costs" />
        </div>
      }
    />
  );
}
