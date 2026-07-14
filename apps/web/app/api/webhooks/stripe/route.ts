import { constructStripeEvent } from '@/lib/payments/stripe';
import { createRepositories } from '@repo/database';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = constructStripeEvent(payload, signature);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentId = session.metadata?.paymentId;
    const repos = createRepositories();

    if (paymentId) {
      await repos.payment.completePayment(paymentId, session.id, {
        stripeSessionId: session.id,
        paymentStatus: session.payment_status,
      });
    } else if (session.id) {
      const payment = await repos.payment.findByExternalId(session.id);
      if (payment) {
        await repos.payment.completePayment(payment.id, session.id, {
          stripeSessionId: session.id,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
