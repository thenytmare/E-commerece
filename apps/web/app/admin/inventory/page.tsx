import { createRepositories } from '@repo/database';
import { requireAdmin } from '@/lib/actions/auth';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { InventoryListClient } from './InventoryListClient';

export const metadata = { title: 'Inventory Alerts | Admin' };

export default async function AdminInventoryPage() {
  await requireAdmin();
  const repos = createRepositories();
  const lowStock = await repos.inventory.findLowStockDetailed();

  return (
    <AdminPage
      title="Inventory Alerts"
      description="Monitor stock levels, track reservation requests, and identify products below threshold levels."
    >
      <InventoryListClient initialLowStock={lowStock} />
    </AdminPage>
  );
}
