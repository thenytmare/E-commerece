import { AdminPage } from '@/components/admin/ui/AdminPage';
import { listBackInStockSubscribers } from '@/lib/actions/admin-back-in-stock';
import { getStoreSettings } from '@/lib/store';
import { BackInStockQueueClient } from './BackInStockQueueClient';
import { requirePermission } from '@/lib/actions/auth';

export const metadata = { title: 'Back in Stock | Admin' };

export default async function BackInStockPage() {
  await requirePermission('inventory.read');
  const [subscribers, settings] = await Promise.all([
    listBackInStockSubscribers(),
    getStoreSettings(),
  ]);

  return (
    <AdminPage
      title="Back-in-Stock Requests"
      description="Customers waiting for out-of-stock products. Once an item is restocked, message them and mark it done."
    >
      <BackInStockQueueClient subscribers={subscribers} storeName={settings.name} />
    </AdminPage>
  );
}
