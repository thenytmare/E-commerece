import { createRepositories } from '@repo/database';
import { requireAdmin } from '@/lib/actions/auth';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { OrdersListClient } from './OrdersListClient';

export const metadata = { title: 'Orders | Admin' };

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAdmin();
  const repos = createRepositories();
  
  const resolvedSearchParams = await searchParams;
  const search = typeof resolvedSearchParams.search === 'string' ? resolvedSearchParams.search : undefined;

  // Fetch the latest 50 orders
  const orders = await repos.order.listAll(50);

  // Simple client-side search filtering
  const filteredOrders = search
    ? orders.filter(
        (order) =>
          order.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
          order.address?.name.toLowerCase().includes(search.toLowerCase()) ||
          order.address?.phone?.includes(search)
      )
    : orders;

  return (
    <AdminPage
      title="Orders"
      description="Manage customer orders, track fulfillment status, and execute cancellations."
    >
      <OrdersListClient initialOrders={filteredOrders} />
    </AdminPage>
  );
}
