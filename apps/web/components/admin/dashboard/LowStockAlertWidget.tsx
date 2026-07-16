import { DashboardWidget } from '@/components/admin/ui/DashboardWidget';
import { getLowStockDashboard } from '@/lib/actions/admin-dashboard';
import Link from 'next/link';

export default async function LowStockAlertWidget() {
  let error: string | null = null;
  let items: {
    variantId: string;
    productName: string;
    quantity: number;
    reserved: number;
    lowStockThreshold: number;
  }[] = [];

  try {
    const data = await getLowStockDashboard();
    items = data.items;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load low stock alerts';
  }

  return (
    <DashboardWidget
      title="Low Stock Alerts"
      icon="shield-alert"
      requiredPermission="inventory.read"
      error={error}
      empty={!error && items.length === 0}
      emptyMessage="All inventory levels look healthy"
      body={
        <div className="space-y-3">
          <p className="text-2xl font-bold text-foreground">{items.length}</p>
          <p className="text-sm text-muted-foreground mb-2">Items at or below threshold</p>
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {items.slice(0, 8).map((item) => (
              <li
                key={item.variantId}
                className="flex items-center justify-between text-sm gap-2 border-b border-border pb-2 last:border-0"
              >
                <span className="truncate text-foreground">{item.productName}</span>
                <span className="text-destructive shrink-0 font-medium">
                  {item.quantity - item.reserved} avail
                </span>
              </li>
            ))}
          </ul>
        </div>
      }
      footer={
        <Link href="/admin/inventory" className="text-sm text-primary hover:underline">
          View inventory
        </Link>
      }
    />
  );
}
