import { getPaymentConfig } from '@repo/config';
import type { OrderDetail } from '@repo/database';
import Stripe from 'stripe';

function getStripeClient(): Stripe {
  const { stripeSecretKey } = getPaymentConfig();
  if (!stripeSecretKey) {
    throw new Error('Stripe is not configured');
  }
  return new Stripe(stripeSecretKey);
}

function orderTotalKes(order: OrderDetail): number {
  return typeof order.total === 'object' && 'toNumber' in order.total
    ? order.total.toNumber()
    : Number(order.total);
}

/** Convert KES amount to Stripe minor units (cents) */
export function toStripeAmount(kes: number): number {
  return Math.round(kes * 100);
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
            name: `TechVault Order ${order.orderNumber}`,
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

export function constructStripeEvent(payload: string, signature: string): Stripe.Event {
  const { stripeWebhookSecret } = getPaymentConfig();
  if (!stripeWebhookSecret) {
    throw new Error('Stripe webhook secret is not configured');
  }
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(payload, signature, stripeWebhookSecret);
}
