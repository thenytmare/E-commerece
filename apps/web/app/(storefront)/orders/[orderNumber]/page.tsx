import { loadViewableOrder } from '@/lib/order-access';
import { formatDate, formatPrice } from '@/lib/format';
import { createRepositories } from '@repo/database';
import { getStoreSettings } from '@/lib/store';
import { deliveryZoneLabel } from '@repo/config';
import { DigitalReceipt } from '@/components/order/DigitalReceipt';
import { Badge, Button, Container, Heading, Section, Text } from '@repo/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface OrderPageProps {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ paid?: string; cod?: string }>;
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
  const repos = createRepositories();
  // Resolves for the owning account or, for a guest order, this browser's
  // signed cookie — so a guest can reach the order they just placed.
  const order = await loadViewableOrder(orderNumber);

  if (!order) {
    notFound();
  }

  const settings = await getStoreSettings();
  const completedPayment = order.payments.find((payment) => payment.status === 'COMPLETED');
  // Cash on Delivery orders are confirmed before any money changes hands.
  const codPayment = order.payments.find(
    (payment) => payment.provider === 'CASH_ON_DELIVERY' && payment.status === 'PENDING'
  );
  // Paid only when a payment record says so. An admin marking an order
  // CONFIRMED does not mean money arrived.
  const isPaid = !codPayment && Boolean(completedPayment);
  const deliverySummary = order.deliveryZone
    ? `${deliveryZoneLabel(order.deliveryZone)}${order.deliveryLocation ? ` · ${order.deliveryLocation}` : ''}`
    : null;
  const awaitingPayment = order.status === 'PENDING' && !completedPayment;

  const receiptProps = {
    storeName: settings.name,
    storePhone: settings.phone,
    storeEmail: settings.email,
    storeAddress: settings.address,
    orderNumber: order.orderNumber,
    orderDate: formatDate(order.createdAt),
    status: order.status,
    customerName: order.user?.name ?? order.address?.name ?? 'Customer',
    customerPhone: order.address?.phone ?? '',
    customerAddress: order.address ? `${order.address.street}, ${order.address.city}, ${order.address.county}` : '',
    items: order.items.map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      price: typeof item.price === 'object' && 'toNumber' in item.price ? item.price.toNumber() : Number(item.price),
    })),
    subtotal: formatPrice(order.subtotal),
    shipping: formatPrice(order.shipping),
    discount: formatPrice(order.discount),
    total: formatPrice(order.total),
    paymentMethod: codPayment
      ? 'Cash on Delivery (pay the rider)'
      : completedPayment
        ? `${completedPayment.provider} (${completedPayment.status})`
        : 'Pending',
  };

  return (
    <main>
      <Section spacing="md" className="border-b border-border bg-card">
        <Container>
          <Badge variant={isPaid || codPayment ? 'success' : 'secondary'} className="mb-4">
            {codPayment ? 'Cash on Delivery' : isPaid ? 'Payment received' : 'Awaiting payment'}
          </Badge>
          <Heading as="h1" size="lg" className="mb-2">
            {isPaid || codPayment ? 'Thank you for your order' : 'Order placed'}
          </Heading>
          <Text variant="muted">
            Order <span className="font-mono font-medium text-foreground">{order.orderNumber}</span>
          </Text>
          {query.paid === '1' && isPaid ? (
            <Text className="mt-3 text-sm text-green-600">
              Your payment was successful. We&apos;ll process your order shortly.
            </Text>
          ) : null}
          {codPayment ? (
            <Text className="mt-3 text-sm text-green-600">
              Your order is confirmed. Please have {formatPrice(order.total)} ready to pay the rider
              on delivery.
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
              <Text className="mb-4 font-semibold">
                {order.deliveryZone === 'PICKUP' ? 'Shop pickup' : 'Shipping to'}
              </Text>
              {deliverySummary ? (
                <Text className="mb-2 text-sm font-medium">{deliverySummary}</Text>
              ) : null}
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
                {codPayment ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Payment</dt>
                    <dd>Cash on Delivery</dd>
                  </div>
                ) : completedPayment ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Payment</dt>
                    <dd>
                      {completedPayment.provider} · {completedPayment.status}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Date</dt>
                  <dd>{formatDate(order.createdAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd>{formatPrice(order.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Delivery</dt>
                  <dd>{Number(order.shipping) === 0 ? 'Free' : formatPrice(order.shipping)}</dd>
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

          {/* Digital Receipt */}
          <div className="mt-8 pt-8 border-t border-border">
            <DigitalReceipt {...receiptProps} />
          </div>

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
