import { PaymentMethodPicker } from '@/components/payment/payment-method-picker';
import { loadViewableOrder } from '@/lib/order-access';
import { getPaymentSettings } from '@/lib/payment-settings';
import { formatPrice } from '@/lib/format';
import { settlePaystackPayment } from '@/lib/payments/paystack-settlement';
import {
  deliveryZoneLabel,
  isIntasendConfigured,
  isMpesaConfigured,
  isPaystackConfigured,
  isPaymentDevMode,
  isStripeConfigured,
} from '@repo/config';
import { createRepositories } from '@repo/database';
import { Container, Heading, Section, Text } from '@repo/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { IntasendBadge } from '@/components/payment/intasend-badge';
import { PaystackBadge } from '@/components/payment/paystack-badge';

interface PayOrderPageProps {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ cancelled?: string; paystack_ref?: string; reference?: string }>;
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

  // Handle return from Paystack checkout:
  const paystackRef = query.paystack_ref ?? query.reference;
  if (paystackRef) {
    const paystackPayment = order.payments.find(
      (p) => p.provider === 'PAYSTACK' && p.status === 'PENDING'
    );
    if (paystackPayment) {
      try {
        const outcome = await settlePaystackPayment(paystackPayment, paystackRef);
        if (outcome === 'completed') {
          redirect(`/orders/${orderNumber}?paid=1`);
        }
      } catch (err) {
        console.error('Failed to verify Paystack payment on return', err);
      }
    }
  }

  const completedPayment = await repos.payment.findCompletedByOrderId(order.id);
  if (order.status !== 'PENDING' || completedPayment) {
    redirect(`/orders/${orderNumber}`);
  }

  const { manualMpesa, methods } = await getPaymentSettings();
  // A method shows when its keys are set AND the owner has not switched it off
  // in the admin panel.
  const stripeConfigured = isStripeConfigured();
  const paystackConfigured = isPaystackConfigured();
  // The M-Pesa prompt works through either route: IntaSend or direct Safaricom.
  const mpesaConfigured = isIntasendConfigured() || isMpesaConfigured();
  const stripeEnabled = stripeConfigured && methods.card;
  const paystackEnabled = paystackConfigured && methods.paystack;
  const mpesaEnabled = mpesaConfigured && methods.mpesaStk;
  // Dev simulation is only for shops with no real provider keys at all, so
  // switching a method off never opens it.
  const devMode =
    isPaymentDevMode() &&
    !stripeConfigured &&
    !mpesaConfigured &&
    !paystackConfigured &&
    !manualMpesa.enabled;
  // Pay on delivery is chosen at checkout, before the customer reaches this
  // page, so it is not offered here.
  const codEnabled = false;

  // Surface this order's existing manual submission so the picker can show the
  // "awaiting confirmation" panel or let the customer resubmit a rejected code.
  const manualPayment = order.payments.find((p) => p.provider === 'MANUAL_MPESA');
  const manualStatus =
    manualPayment?.status === 'AWAITING_CONFIRMATION'
      ? 'AWAITING_CONFIRMATION'
      : manualPayment?.status === 'FAILED'
        ? 'FAILED'
        : null;

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
              paystackEnabled={paystackEnabled}
              codEnabled={codEnabled}
              manualMpesa={
                manualMpesa.enabled
                  ? {
                      businessName: manualMpesa.businessName,
                      paybillNumber: manualMpesa.paybillNumber,
                      accountNumber: manualMpesa.accountNumber,
                      accountName: manualMpesa.accountName,
                      contactPhone: manualMpesa.contactPhone,
                      instructions: manualMpesa.instructions,
                    }
                  : null
              }
              manualStatus={manualStatus}
              // `devMode` already means "dev mode AND no real provider
              // configured". OR-ing isPaymentDevMode() back in cancelled that
              // out, showing the simulate-payment panel on any staging
              // environment that had real provider keys set.
              devMode={devMode}
              cancelled={query.cancelled === '1'}
              mpesaBadge={<IntasendBadge wide />}
              paystackBadge={<PaystackBadge />}
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
