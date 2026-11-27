import { DashboardWidget } from '@/components/admin/ui/DashboardWidget';
import { getRevenueDashboard } from '@/lib/actions/admin-dashboard';
import { formatPrice } from '@/lib/format';
import { TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';

export default async function RevenueWidget() {
  let error: string | null = null;
  let totalRevenue = 0;
  let lastMonthRevenue = 0;
  let prevMonthRevenue = 0;

  try {
    const data = await getRevenueDashboard();
    totalRevenue = data.totalRevenue;
    const trend = data.monthlyTrend;
    lastMonthRevenue = trend[trend.length - 1]?.revenue ?? 0;
    prevMonthRevenue = trend[trend.length - 2]?.revenue ?? 0;
  } catch (e) {
    console.error('RevenueWidget: Failed to load revenue', e);
    error = e instanceof Error ? e.message : 'Failed to load revenue';
  }

  const trendPct =
    prevMonthRevenue > 0
      ? Math.round(((lastMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100)
      : undefined;

  return (
    <DashboardWidget
      title="Revenue"
      icon="dollar-sign"
      requiredPermission="analytics.read"
      error={error}
      empty={!error && totalRevenue === 0}
      emptyMessage="No completed payments yet"
      body={
        <div className="space-y-3">
          <p className="text-3xl font-bold text-foreground">{formatPrice(totalRevenue)}</p>
          {trendPct !== undefined && (
            <div className="flex items-center gap-1 text-sm">
              {trendPct > 0 ? (
                <TrendingUp className="h-4 w-4 text-success" />
              ) : trendPct < 0 ? (
                <TrendingDown className="h-4 w-4 text-destructive" />
              ) : null}
              <span
                className={
                  trendPct > 0
                    ? 'text-success font-medium'
                    : trendPct < 0
                      ? 'text-destructive font-medium'
                      : 'text-muted-foreground'
                }
              >
                {trendPct > 0 ? '+' : ''}
                {trendPct}%
              </span>
              <span className="text-muted-foreground">vs prior month</span>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Latest month:{' '}
            <span className="font-medium text-foreground">{formatPrice(lastMonthRevenue)}</span>
          </p>
        </div>
      }
      footer={
        <Link href="/admin/orders" className="text-sm text-primary hover:underline">
          View orders
        </Link>
      }
    />
  );
}
