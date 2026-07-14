import { OrderStatusForm } from '@/components/admin/order-status-form';
import { requireAdmin } from '@/lib/actions/auth';
import { formatPrice } from '@/lib/format';
import { createRepositories } from '@repo/database';
import { Badge, Container, Heading, Section, Text } from '@repo/ui';
import Link from 'next/link';

const statusVariant: Record<string, 'default' | 'secondary' | 'success' | 'outline'> = {
  PENDING: 'secondary',
  CONFIRMED: 'success',
  PROCESSING: 'default',
  SHIPPED: 'default',
  DELIVERED: 'success',
  CANCELLED: 'outline',
  REFUNDED: 'outline',
};

export const metadata = {
  title: 'Admin Orders',
};

export default async function AdminOrdersPage() {
  await requireAdmin();
  const repos = createRepositories();
  const orders = await repos.order.listAll(50);

  return (
    <main>
      <Section spacing="md" className="border-b border-border bg-card">
        <Container>
          <Heading as="h1" size="lg" className="mb-2">
            Order Management
          </Heading>
          <Text variant="muted">Recent orders and fulfillment actions.</Text>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="space-y-4">
            {orders.map((order) => {
              const completedPayment = order.payments.find(
                (payment) => payment.status === 'COMPLETED'
              );

              return (
                <div key={order.id} className="rounded-xl border border-border bg-card p-6">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant={statusVariant[order.status] ?? 'secondary'}>
                          {order.status}
                        </Badge>
                        {completedPayment ? (
                          <Badge variant="success">{completedPayment.provider} paid</Badge>
                        ) : (
                          <Badge variant="outline">Unpaid</Badge>
                        )}
                      </div>
                      <Heading as="h2" size="xs" className="mb-1">
                        {order.orderNumber}
                      </Heading>
                      <Text variant="muted" className="text-sm">
                        {order.userId ? 'Registered customer' : 'Guest order'} ·{' '}
                        {order.createdAt.toLocaleDateString('en-KE')}
                      </Text>
                    </div>
                    <div className="text-right">
                      <Text className="font-semibold">{formatPrice(order.total)}</Text>
                      <Text variant="muted" className="text-sm">
                        {order.items.length} item{order.items.length === 1 ? '' : 's'}
                      </Text>
                    </div>
                  </div>

                  <div className="mb-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <Text className="mb-2 font-medium">Customer</Text>
                      <Text variant="muted" className="text-sm">
                        {order.address?.name ?? 'N/A'}
                      </Text>
                      <Text variant="muted" className="text-sm">
                        {order.address?.phone ?? 'No phone'}
                      </Text>
                    </div>
                    <div>
                      <Text className="mb-2 font-medium">Delivery Address</Text>
                      <Text variant="muted" className="text-sm">
                        {order.address
                          ? `${order.address.street}, ${order.address.city}, ${order.address.county}`
                          : 'No address'}
                      </Text>
                    </div>
                  </div>

                  <div className="mb-4 rounded-lg bg-muted/30 p-4">
                    <Text className="mb-2 font-medium">Items</Text>
                    <ul className="space-y-2">
                      {order.items.map((item) => (
                        <li key={item.id} className="flex justify-between gap-4 text-sm">
                          <Link
                            href={`/products/${item.product.slug}`}
                            className="hover:underline"
                          >
                            {item.name} x {item.quantity}
                          </Link>
                          <span className="font-medium">
                            {formatPrice(
                              (typeof item.price === 'object' && 'toNumber' in item.price
                                ? item.price.toNumber()
                                : Number(item.price)) * item.quantity
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <OrderStatusForm order={order} />
                </div>
              );
            })}
          </div>
        </Container>
      </Section>
    </main>
  );
}
