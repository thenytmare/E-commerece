import { createRepositories, type OrderStatus } from '@repo/database';
import { requirePermission } from '@/lib/actions/auth';
import { serializeDecimals } from '@/lib/serialize';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { OrdersListClient } from './OrdersListClient';

export const metadata = { title: 'Orders | Admin' };

const ORDER_STATUSES: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

function readParam(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requirePermission('orders.read');
  const repos = createRepositories();

  const params = await searchParams;
  const search = readParam(params.search);
  const statusParam = readParam(params.status);
  const status = ORDER_STATUSES.find((value) => value === statusParam);
  const page = Number(readParam(params.page) ?? '1') || 1;

  // Searching and paging both happen in SQL now, so the admin can reach every
  // order rather than only the fifty most recent.
  const result = await repos.order.adminFindMany({ search, status, page, limit: 25 });

  return (
    <AdminPage
      title="Orders"
      description="Manage customer orders, track fulfillment status, and execute cancellations."
    >
      {/* Serialized because OrdersListClient is a Client Component and every
          money column comes back from Prisma as Decimal. */}
      <OrdersListClient
        initialOrders={serializeDecimals(result.items)}
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        initialSearch={search ?? ''}
        activeStatus={status ?? ''}
      />
    </AdminPage>
  );
}
