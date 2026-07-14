import { PaymentMethodPicker } from '@/components/payment/payment-method-picker';
import { requireAuth } from '@/lib/actions/auth';
import { formatPrice } from '@/lib/format';
import {
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
  const session = await requireAuth();
  const repos = createRepositories();
  const order = await repos.order.findByOrderNumberForUser(orderNumber, session.user.id);

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
              order={order}
              stripeEnabled={stripeEnabled}
              mpesaEnabled={mpesaEnabled}
              devMode={devMode || isPaymentDevMode()}
              cancelled={query.cancelled === '1'}
            />
            <Text variant="muted" className="mt-6 text-center text-xs">
              Total: {formatPrice(order.total)} · Stock reserved until payment completes
            </Text>
          </div>
        </Container>
      </Section>
    </main>
  );
}
