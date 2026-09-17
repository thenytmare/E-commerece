import { DashboardWidget } from '@/components/admin/ui/DashboardWidget';
import { getSalesAnalyticsDashboard } from '@/lib/actions/admin-dashboard';
import { formatPrice } from '@/lib/format';
import Link from 'next/link';

export default async function SalesAnalyticsWidget() {
  let error: string | null = null;
  let topProducts: { id: string; name: string; sold: number }[] = [];
  let revenueByCategory: { category: string; revenue: number }[] = [];

  try {
    const data = await getSalesAnalyticsDashboard();
    topProducts = data.topProducts;
    revenueByCategory = data.revenueByCategory;
  } catch (e) {
    console.error('SalesAnalyticsWidget: Failed to load sales analytics', e);
    error = e instanceof Error ? e.message : 'Failed to load sales analytics';
  }

  const empty = !error && topProducts.length === 0 && revenueByCategory.length === 0;

  return (
    <DashboardWidget
      title="Sales Analytics"
      icon="bar-chart"
      requiredPermission="analytics.read"
      error={error}
      empty={empty}
      emptyMessage="No sales data yet"
      body={
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Top products
            </h4>
            <ul className="space-y-2">
              {topProducts.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm gap-2">
                  <span className="truncate text-foreground">{p.name}</span>
                  <span className="text-muted-foreground shrink-0">{p.sold} sold</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              By category
            </h4>
            <ul className="space-y-2">
              {revenueByCategory.slice(0, 5).map((c) => (
                <li key={c.category} className="flex items-center justify-between text-sm gap-2">
                  <span className="truncate text-foreground">{c.category}</span>
                  <span className="text-muted-foreground shrink-0">{formatPrice(c.revenue)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      }
      footer={
        <Link href="/admin/catalog/products" className="text-sm text-primary hover:underline">
          Manage products
        </Link>
      }
    />
  );
}
