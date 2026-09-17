import { createRepositories } from '@repo/database';
import { requirePermission } from '@/lib/actions/auth';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import { formatDate, formatDateTime, formatPrice } from '@/lib/format';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Customer | Admin' };

/**
 * Customer detail.
 *
 * The customer list has always linked here, but the route didn't exist — the
 * link 404'd, while the purpose-built query below (`findByIdForAdmin`, which
 * eager-loads roles, addresses, recent orders and wishlist) sat unused.
 */
export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('customers.read');
  const { id } = await params;

  const customer = await createRepositories().user.findByIdForAdmin(id);
  if (!customer) {
    notFound();
  }

  const totalSpent = customer.orders
    .filter((order) => order.payments.some((payment) => payment.status === 'COMPLETED'))
    .reduce((sum, order) => sum + Number(order.total), 0);

  return (
    <AdminPage
      title={customer.name || customer.email}
      description={`Customer since ${formatDate(customer.createdAt)}`}
      actions={
        <Link
          href="/admin/customers"
          className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to customers
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 font-semibold">Recent orders</h2>
            {customer.orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This customer hasn&apos;t placed an order yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {customer.orders.map((order) => (
                  <li key={order.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/orders/${order.orderNumber}`}
                        className="font-medium hover:text-primary"
                      >
                        {order.orderNumber}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(order.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StatusBadge status="info" label={order.status} />
                      <span className="text-sm font-semibold">{formatPrice(order.total)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 font-semibold">Addresses</h2>
            {customer.addresses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved addresses.</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {customer.addresses.map((address) => (
                  <li key={address.id} className="rounded-lg border border-border p-4 text-sm">
                    <p className="font-medium">
                      {address.name}
                      {address.isDefault ? (
                        <span className="ml-2 text-xs text-muted-foreground">(default)</span>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground">{address.phone}</p>
                    <p className="text-muted-foreground">
                      {address.street}, {address.city}, {address.county}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 font-semibold">Contact</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="break-all">{customer.email}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Phone</dt>
                <dd>{customer.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="mt-1">
                  <StatusBadge
                    status={customer.deletedAt ? 'archived' : customer.isActive ? 'success' : 'draft'}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Roles</dt>
                <dd>{customer.roles.map((entry) => entry.role.name).join(', ') || 'CUSTOMER'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 font-semibold">Lifetime value</h2>
            <p className="text-2xl font-bold">{formatPrice(totalSpent)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Across {customer.orders.length} order{customer.orders.length === 1 ? '' : 's'}
            </p>
          </div>

          {customer.wishlists.length > 0 ? (
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-4 font-semibold">Wishlist</h2>
              <ul className="space-y-2 text-sm">
                {customer.wishlists.map((entry) => (
                  <li key={entry.id}>
                    <Link
                      href={`/products/${entry.product.slug}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {entry.product.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </AdminPage>
  );
}
