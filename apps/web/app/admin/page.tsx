import { requireAdmin } from '@/lib/actions/auth';
import { createRepositories } from '@repo/database';
import { Badge, Container, Heading, Section, Text } from '@repo/ui';
import Link from 'next/link';

export const metadata = {
  title: 'Admin',
};

export default async function AdminPage() {
  const session = await requireAdmin();
  const repos = createRepositories();
  const [recentOrders, lowStock] = await Promise.all([
    repos.order.listAll(5),
    repos.inventory.findLowStockDetailed(),
  ]);

  return (
    <Section>
      <Container>
        <Badge variant="secondary" className="mb-4">
          Admin
        </Badge>
        <Heading as="h1" size="xl" className="mb-4">
          Dashboard
        </Heading>
        <Text variant="muted" className="mb-6">
          Signed in as {session.user.email} ({session.user.roles.join(', ')})
        </Text>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-6">
            <Text variant="muted" className="mb-1 text-sm">
              Recent Orders
            </Text>
            <Heading as="h2" size="sm">
              {recentOrders.length}
            </Heading>
          </div>
          <div className="rounded-lg border border-border bg-card p-6">
            <Text variant="muted" className="mb-1 text-sm">
              Low Stock Alerts
            </Text>
            <Heading as="h2" size="sm">
              {lowStock.length}
            </Heading>
          </div>
          <div className="rounded-lg border border-border bg-card p-6">
            <Text variant="muted" className="mb-1 text-sm">
              Paid Orders
            </Text>
            <Heading as="h2" size="sm">
              {recentOrders.filter((order) =>
                order.payments.some((payment) => payment.status === 'COMPLETED')
              ).length}
            </Heading>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/admin/orders"
            className="rounded-lg border border-border bg-card p-6 transition-shadow hover:shadow-md"
          >
            <Heading as="h2" size="xs" className="mb-2">
              Manage Orders
            </Heading>
            <Text variant="muted">
              Review payments, advance fulfillment statuses, and cancel pending orders.
            </Text>
          </Link>
          <Link
            href="/admin/inventory"
            className="rounded-lg border border-border bg-card p-6 transition-shadow hover:shadow-md"
          >
            <Heading as="h2" size="xs" className="mb-2">
              Inventory Alerts
            </Heading>
            <Text variant="muted">
              Monitor low-stock variants before availability affects checkout.
            </Text>
          </Link>
        </div>
      </Container>
    </Section>
  );
}
