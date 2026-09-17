import { createRepositories } from '@repo/database';
import { requirePermission } from '@/lib/actions/auth';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { CustomerListClient } from './CustomerListClient';
import type { AdminUserListItem } from '@repo/database';

export const metadata = { title: 'Customers | Admin' };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requirePermission('customers.read');
  const repos = createRepositories();

  const params = await searchParams;
  const search = typeof params.search === 'string' && params.search.trim() ? params.search.trim() : undefined;
  const page = Number(typeof params.page === 'string' ? params.page : '1') || 1;
  // Both sets are fetched so the client's Active/Trash toggle has data for
  // either tab. Previously only active rows were loaded, so an archived
  // customer could never be found or restored through the UI.
  // Paged and searched in SQL so the admin can reach every customer, not just
  // the first fifty. Both deletion states are fetched so the Active/Trash
  // toggle has data for either tab.
  const limit = 25;
  const [activeResult, archivedResult] = await Promise.all([
    repos.user.adminFindMany({ isDeleted: false, search, page, limit }),
    repos.user.adminFindMany({ isDeleted: true, search, page, limit }),
  ]);
  const items = [...activeResult.items, ...archivedResult.items];
  const total = activeResult.total + archivedResult.total;
  const totalPages = Math.max(1, Math.ceil(Math.max(activeResult.total, archivedResult.total) / limit));

  const customers: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    isActive: boolean;
    roles: string[];
    ordersCount: number;
    createdAt: Date;
    isDeleted: boolean;
  }[] = items.map((u: AdminUserListItem) => ({
    id: u.id,
    name: u.name || u.email.split('@')[0] || 'Unknown',
    email: u.email,
    phone: u.phone,
    isActive: u.isActive,
    roles: u.roles.map(r => r.role.name),
    ordersCount: u._count.orders,
    createdAt: u.createdAt,
    isDeleted: u.deletedAt !== null,
  }));

  return (
    <AdminPage title="Customers" description="Manage customer accounts and profiles.">
      <CustomerListClient
        initialData={customers}
        page={page}
        totalPages={totalPages}
        total={total}
        initialSearch={search ?? ''}
      />
    </AdminPage>
  );
}