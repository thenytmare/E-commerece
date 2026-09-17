import { constructStripeEvent } from '@/lib/payments/stripe';
import { createRepositories } from '@repo/database';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

/**
 * Resolve the Payment row for a Stripe checkout session.
 *
 * Prefers the id embedded in metadata at session-creation time, because that
 * stays correct even if the payment's externalId is later overwritten by a
 * retry.
 */
async function resolvePaymentId(
  repos: ReturnType<typeof createRepositories>,
  session: Stripe.Checkout.Session
): Promise<string | null> {
  const fromMetadata = session.metadata?.paymentId;
  if (fromMetadata) return fromMetadata;
  if (!session.id) return null;

  const payment = await repos.payment.findByExternalId(session.id, 'STRIPE');
  return payment?.id ?? null;
}

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    // Verified against the raw body — never the parsed JSON.
    event = constructStripeEvent(payload, signature);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const repos = createRepositories();

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = await resolvePaymentId(repos, session);
      if (!paymentId) break;

      // `completed` fires when the session finishes, which is not the same as
      // the money having settled — for delayed payment methods it can arrive
      // while payment_status is still 'unpaid'. Only 'paid' confirms an order.
      if (session.payment_status !== 'paid') {
        break;
      }

      await repos.payment.completePayment(paymentId, session.id, {
        stripeSessionId: session.id,
        paymentStatus: session.payment_status,
      });
      break;
    }

    // Without these the payment sat PENDING forever: unlike M-Pesa there is no
    // status-query fallback for Stripe, so an abandoned or failed checkout had
    // no path back to a terminal state.
    case 'checkout.session.expired':
    case 'checkout.session.async_payment_failed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = await resolvePaymentId(repos, session);
      if (!paymentId) break;

      await repos.payment.markFailed(
        paymentId,
        { stripeSessionId: session.id, stripeEvent: event.type },
        event.type === 'checkout.session.expired'
          ? 'Checkout session expired before payment was completed.'
          : 'Stripe reported the payment failed.'
      );
      break;
    }

    default:
      // Unhandled event types are acknowledged so Stripe stops retrying them.
      break;
  }

  return NextResponse.json({ received: true });
}
