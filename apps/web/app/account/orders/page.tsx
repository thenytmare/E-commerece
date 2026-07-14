import { requireAuth } from '@/lib/actions/auth';
import { formatPrice } from '@/lib/format';
import { createRepositories } from '@repo/database';
import { Badge, Button, Container, Heading, Section, Text } from '@repo/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'My Orders',
};

const statusVariant: Record<string, 'default' | 'secondary' | 'success' | 'outline'> = {
  PENDING: 'secondary',
  CONFIRMED: 'success',
  PROCESSING: 'default',
  SHIPPED: 'default',
  DELIVERED: 'success',
  CANCELLED: 'outline',
  REFUNDED: 'outline',
};

export default async function AccountOrdersPage() {
  const session = await requireAuth();
  const repos = createRepositories();
  const orders = await repos.order.listByUserId(session.user.id);

  return (
    <main>
      <Section spacing="md" className="border-b border-border bg-card">
        <Container>
          <Heading as="h1" size="lg" className="mb-2">
            My Orders
          </Heading>
          <Text variant="muted">
            <Link href="/account" className="underline-offset-4 hover:underline">
              Back to account
            </Link>
          </Text>
        </Container>
      </Section>

      <Section>
        <Container>
          {orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
              <Heading as="h2" size="sm" className="mb-3">
                No orders yet
              </Heading>
              <Text variant="muted" className="mb-6">
                When you place an order, it will appear here.
              </Text>
              <Button asChild>
                <Link href="/products">Start shopping</Link>
              </Button>
            </div>
          ) : (
            <ul className="space-y-4">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/orders/${order.orderNumber}`}
                    className="block rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <Text className="font-mono font-medium">{order.orderNumber}</Text>
                        <Text variant="muted" className="text-sm">
                          {order.createdAt.toLocaleDateString('en-KE')} · {order.items.length}{' '}
                          item{order.items.length === 1 ? '' : 's'}
                        </Text>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={statusVariant[order.status] ?? 'secondary'}>
                          {order.status}
                        </Badge>
                        <Text className="font-semibold">{formatPrice(order.total)}</Text>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Container>
      </Section>
    </main>
  );
}
