/**
 * Stripe amount rules for Kenyan shillings.
 *
 * Kept in the shared config package (no Stripe SDK needed) so the rules can be
 * unit tested on their own.
 */

/**
 * Convert a KES amount to the integer Stripe expects.
 *
 * Stripe treats KES as a two-decimal currency: amounts are sent in cents, so
 * KES 1,500 is 150000. It is not on Stripe's zero-decimal list. Sending the
 * shilling amount unchanged would charge 1/100th of the order total.
 * https://docs.stripe.com/currencies
 */
export function toStripeAmount(kes: number): number {
  return Math.round(kes * 100);
}

export interface StripePaymentRecord {
  id: string;
  orderId: string;
  provider: string;
  externalId: string | null;
  amount: { toString(): string };
}

export interface StripeSessionFacts {
  id: string;
  currency?: string | null;
  amount_total?: number | null;
  metadata?: Record<string, string> | null;
}

export type StripeCheckResult = { ok: true } | { ok: false; reason: string };

/**
 * Check that a Stripe Checkout Session really is the payment we expect before
 * any order is confirmed: our own payment row, the right currency and the
 * right amount (in Stripe's minor units).
 *
 * A valid webhook signature only proves the event came from Stripe. It does
 * not prove the customer paid the right amount for this order.
 */
export function checkStripeSession(
  payment: StripePaymentRecord,
  session: StripeSessionFacts
): StripeCheckResult {
  if (payment.provider !== 'STRIPE') {
    return { ok: false, reason: 'Payment is not a Stripe payment' };
  }

  const metaPaymentId = session.metadata?.paymentId;
  const metaOrderId = session.metadata?.orderId;
  const sameSession = Boolean(payment.externalId) && payment.externalId === session.id;
  if (!sameSession && metaPaymentId !== payment.id) {
    return { ok: false, reason: 'Session does not belong to this payment' };
  }
  if (metaOrderId && metaOrderId !== payment.orderId) {
    return { ok: false, reason: 'Session was created for a different order' };
  }

  if ((session.currency ?? '').toLowerCase() !== 'kes') {
    return { ok: false, reason: `Unexpected currency: ${session.currency ?? 'none'}` };
  }

  const expected = toStripeAmount(Number(payment.amount.toString()));
  if (session.amount_total !== expected) {
    return {
      ok: false,
      reason: `Amount mismatch: Stripe reports ${session.amount_total ?? 'none'}, expected ${expected}`,
    };
  }

  return { ok: true };
}
