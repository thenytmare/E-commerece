import { getPaymentConfig } from '@repo/config';
import type { OrderDetail } from '@repo/database';
import Stripe from 'stripe';

// Matches the discipline already applied to the M-Pesa client — without an
// explicit timeout, a hung Stripe call falls back to the SDK's own default
// (~80s), which can hold a checkout request open far longer than most
// hosting platforms allow.
const STRIPE_TIMEOUT_MS = 15_000;

function getStripeClient(): Stripe {
  const { stripeSecretKey } = getPaymentConfig();
  if (!stripeSecretKey) {
    throw new Error('Stripe is not configured');
  }
  return new Stripe(stripeSecretKey, { timeout: STRIPE_TIMEOUT_MS });
}

function orderTotalKes(order: OrderDetail): number {
  return typeof order.total === 'object' && 'toNumber' in order.total
    ? order.total.toNumber()
    : Number(order.total);
}

/**
 * Convert a KES amount to the integer Stripe expects.
 *
 * KES is a zero-decimal currency on Stripe — amounts are passed as whole
 * shillings with no minor unit. Multiplying by 100 would charge customers
 * 100× the intended price.
 * https://stripe.com/docs/currencies#zero-decimal
 */
export function toStripeAmount(kes: number): number {
  return Math.round(kes);
}

export async function createStripeCheckoutSession(
  order: OrderDetail,
  paymentId: string
): Promise<Stripe.Checkout.Session> {
  const { appUrl } = getPaymentConfig();
  const stripe = getStripeClient();
  const total = orderTotalKes(order);

  return stripe.checkout.sessions.create({
    mode: 'payment',
    currency: 'kes',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'kes',
          unit_amount: toStripeAmount(total),
          product_data: {
            name: `Prime Accessories Kenya Order ${order.orderNumber}`,
            description: `${order.items.length} item(s)`,
          },
        },
      },
    ],
    success_url: `${appUrl}/orders/${order.orderNumber}?paid=1`,
    cancel_url: `${appUrl}/orders/${order.orderNumber}/pay?cancelled=1`,
    metadata: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentId,
    },
  });
}

/**
 * Look up a Checkout Session's authoritative current state directly from
 * Stripe, bypassing whatever a (possibly lost) webhook reported.
 */
export function retrieveStripeCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient();
  return stripe.checkout.sessions.retrieve(sessionId);
}

export function constructStripeEvent(payload: string, signature: string): Stripe.Event {
  const { stripeWebhookSecret } = getPaymentConfig();
  if (!stripeWebhookSecret) {
    throw new Error('Stripe webhook secret is not configured');
  }
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(payload, signature, stripeWebhookSecret);
}
