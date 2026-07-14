import { requireAuth } from '@/lib/actions/auth';
import { formatPrice } from '@/lib/format';
import { createRepositories } from '@repo/database';
import { Badge, Button, Container, Heading, Section, Text } from '@repo/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface OrderPageProps {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ paid?: string }>;
}

const statusVariant: Record<string, 'default' | 'secondary' | 'success' | 'outline'> = {
  PENDING: 'secondary',
  CONFIRMED: 'success',
  PROCESSING: 'default',
  SHIPPED: 'default',
  DELIVERED: 'success',
  CANCELLED: 'outline',
  REFUNDED: 'outline',
};

export async function generateMetadata({ params }: OrderPageProps): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: `Order ${orderNumber}` };
}

export default async function OrderConfirmationPage({ params, searchParams }: OrderPageProps) {
  const { orderNumber } = await params;
  const query = await searchParams;
  const session = await requireAuth();
  const repos = createRepositories();
  const order = await repos.order.findByOrderNumberForUser(orderNumber, session.user.id);

  if (!order) {
    notFound();
  }

  const completedPayment = order.payments.find((payment) => payment.status === 'COMPLETED');
  const isPaid = order.status === 'CONFIRMED' || Boolean(completedPayment);
  const awaitingPayment = order.status === 'PENDING' && !completedPayment;

  return (
    <main>
      <Section spacing="md" className="border-b border-border bg-card">
        <Container>
          <Badge variant={isPaid ? 'success' : 'secondary'} className="mb-4">
            {isPaid ? 'Payment received' : 'Awaiting payment'}
          </Badge>
          <Heading as="h1" size="lg" className="mb-2">
            {isPaid ? 'Thank you for your order' : 'Order placed'}
          </Heading>
          <Text variant="muted">
            Order <span className="font-mono font-medium text-foreground">{order.orderNumber}</span>
          </Text>
          {query.paid === '1' && isPaid ? (
            <Text className="mt-3 text-sm text-green-600">
              Your payment was successful. We&apos;ll process your order shortly.
            </Text>
          ) : null}
          {awaitingPayment ? (
            <div className="mt-4">
              <Button asChild>
                <Link href={`/orders/${order.orderNumber}/pay`}>Complete payment</Link>
              </Button>
            </div>
          ) : null}
        </Container>
      </Section>

      <Section>
        <Container className="space-y-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6">
              <Text className="mb-4 font-semibold">Shipping to</Text>
              {order.address ? (
                <address className="not-italic text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{order.address.name}</p>
                  <p>{order.address.phone}</p>
                  <p>
                    {order.address.street}, {order.address.city}
                  </p>
                  <p>{order.address.county}</p>
                </address>
              ) : (
                <Text variant="muted">No address on file</Text>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <Text className="mb-4 font-semibold">Order details</Text>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <Badge variant={statusVariant[order.status] ?? 'secondary'}>
                      {order.status}
                    </Badge>
                  </dd>
                </div>
                {completedPayment ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Payment</dt>
                    <dd>
                      {completedPayment.provider} · {completedPayment.status}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Date</dt>
                  <dd>{order.createdAt.toLocaleDateString('en-KE')}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd>{formatPrice(order.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Shipping</dt>
                  <dd>{formatPrice(order.shipping)}</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-2 font-semibold">
                  <dt>Total</dt>
                  <dd>{formatPrice(order.total)}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <Text className="mb-4 font-semibold">Items</Text>
            <ul className="divide-y divide-border">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 py-4 text-sm">
                  <div>
                    <Link
                      href={`/products/${item.product.slug}`}
                      className="font-medium hover:underline"
                    >
                      {item.name}
                    </Link>
                    <p className="text-muted-foreground">SKU: {item.sku} · Qty: {item.quantity}</p>
                  </div>
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

          {order.notes ? (
            <div className="rounded-xl border border-border bg-muted/30 p-6">
              <Text className="mb-2 font-semibold">Order notes</Text>
              <Text variant="muted">{order.notes}</Text>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Link
              href="/account/orders"
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              View all orders
            </Link>
            <Link
              href="/products"
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              Continue shopping
            </Link>
          </div>
        </Container>
      </Section>
    </main>
  );
}
