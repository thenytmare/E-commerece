import { PaymentMethodPicker } from '@/components/payment/payment-method-picker';
import { loadViewableOrder } from '@/lib/order-access';
import { formatPrice } from '@/lib/format';
import {
  deliveryZoneLabel,
  isCashOnDeliveryAvailable,
  isMpesaConfigured,
  isPaymentDevMode,
  isStripeConfigured,
} from '@repo/config';
import { createRepositories } from '@repo/database';
import { Container, Heading, Section, Text } from '@repo/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

interface PayOrderPageProps {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ cancelled?: string }>;
}

export async function generateMetadata({ params }: PayOrderPageProps): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: `Pay Order ${orderNumber}` };
}

export default async function PayOrderPage({ params, searchParams }: PayOrderPageProps) {
  const { orderNumber } = await params;
  const query = await searchParams;
  const repos = createRepositories();
  // Resolves for the owning account or, for a guest order, this browser's
  // signed cookie — so a guest can reach the order they just placed.
  const order = await loadViewableOrder(orderNumber);

  if (!order) {
    notFound();
  }

  const completedPayment = await repos.payment.findCompletedByOrderId(order.id);
  if (order.status !== 'PENDING' || completedPayment) {
    redirect(`/orders/${orderNumber}`);
  }

  const stripeEnabled = isStripeConfigured();
  const mpesaEnabled = isMpesaConfigured();
  const devMode = isPaymentDevMode() && !stripeEnabled && !mpesaEnabled;
  const codEnabled = isCashOnDeliveryAvailable(order.deliveryZone);

  return (
    <main>
      <Section spacing="md" className="border-b border-border bg-card">
        <Container>
          <Heading as="h1" size="lg" className="mb-2">
            Complete payment
          </Heading>
          <Text variant="muted">
            <Link href={`/orders/${orderNumber}`} className="underline-offset-4 hover:underline">
              View order details
            </Link>
          </Text>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="mx-auto max-w-lg">
            <PaymentMethodPicker
              initialPaymentId={order.payments.find(p => p.provider === 'MPESA' && p.status === 'PENDING' && p.externalId)?.id}
              orderNumber={order.orderNumber}
              total={Number(order.total)}
              stripeEnabled={stripeEnabled}
              mpesaEnabled={mpesaEnabled}
              codEnabled={codEnabled}
              // `devMode` already means "dev mode AND no real provider
              // configured". OR-ing isPaymentDevMode() back in cancelled that
              // out, showing the simulate-payment panel on any staging
              // environment that had real provider keys set.
              devMode={devMode}
              cancelled={query.cancelled === '1'}
            />
            <p className="mt-4 text-center text-sm"><Link href="/cart" className="underline">Back to cart — your items are saved</Link></p>
            <Text variant="muted" className="mt-6 text-center text-xs">
              {deliveryZoneLabel(order.deliveryZone)}
              {order.deliveryLocation ? ` to ${order.deliveryLocation}` : ''} · Delivery{' '}
              {Number(order.shipping) === 0 ? 'free' : formatPrice(order.shipping)} · Total:{' '}
              {formatPrice(order.total)} · Stock reserved until payment completes
            </Text>
          </div>
        </Container>
      </Section>
    </main>
  );
}
