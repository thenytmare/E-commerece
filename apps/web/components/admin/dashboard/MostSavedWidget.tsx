import { DashboardWidget } from '@/components/admin/ui/DashboardWidget';
import { getMostSavedDashboard, type MostSavedResponse } from '@/lib/actions/admin-dashboard';
import Link from 'next/link';

/**
 * The products shoppers save with the heart most often. They show interest,
 * so they are good picks for a flash sale or the homepage.
 */
export default async function MostSavedWidget() {
  let error: string | null = null;
  let items: MostSavedResponse['items'] = [];

  try {
    items = (await getMostSavedDashboard()).items;
  } catch (e) {
    console.error('MostSavedWidget: Failed to load saved products', e);
    error = e instanceof Error ? e.message : 'Failed to load saved products';
  }

  return (
    <DashboardWidget
      title="Most saved products"
      icon="heart"
      requiredPermission="analytics.read"
      error={error}
      empty={!error && items.length === 0}
      emptyMessage="Nothing saved yet. Shoppers save products with the heart button."
      body={
        <div className="space-y-2">
          <p className="mb-2 text-sm text-muted-foreground">
            Products shoppers saved with the heart. Good picks for a flash sale.
          </p>
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {items.map((item) => (
              <li
                key={item.productId}
                className="flex items-center justify-between gap-2 border-b border-border pb-2 text-sm last:border-0"
              >
                <Link
                  href={`/admin/catalog/products/${item.productId}`}
                  className="truncate text-foreground hover:text-primary hover:underline"
                >
                  {item.name}
                </Link>
                <span
                  className="shrink-0 font-medium text-foreground"
                  title={`${item.customerSaves} by signed-in customers, ${item.saves - item.customerSaves} by guests`}
                >
                  {item.saves} {item.saves === 1 ? 'save' : 'saves'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      }
    />
  );
}
