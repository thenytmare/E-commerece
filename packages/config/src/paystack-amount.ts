/**
 * Paystack amount rules and transaction checks for Kenyan shillings.
 *
 * Kept in the shared config package (no Paystack SDK needed) so the rules can be
 * unit tested on their own.
 */

/**
 * Convert a KES amount to the integer Paystack expects (subunits / cents).
 *
 * Paystack treats KES as a two-decimal subunit currency: amounts are sent in cents,
 * so KES 1,500 is 150000.
 * https://paystack.com/docs/payments/currencies/
 */
export function toPaystackAmount(kes: number): number {
  return Math.round(kes * 100);
}

export interface PaystackPaymentRecord {
  id: string;
  orderId: string;
  provider: string;
  externalId: string | null;
  amount: { toString(): string };
}

export interface PaystackTransactionFacts {
  id?: number | string | null;
  reference?: string | null;
  status?: string | null;
  currency?: string | null;
  amount?: number | null;
  metadata?: {
    paymentId?: string;
    orderId?: string;
    orderNumber?: string;
    [key: string]: unknown;
  } | null;
}

export type PaystackCheckResult = { ok: true } | { ok: false; reason: string };

/**
 * Check that a Paystack transaction really is the payment we expect before
 * any order is confirmed: our own payment row, the right currency and the
 * right amount (in Paystack's minor subunits).
 *
 * A valid webhook signature only proves the event came from Paystack. It does
 * not prove the customer paid the right amount for this order.
 */
export function checkPaystackTransaction(
  payment: PaystackPaymentRecord,
  transaction: PaystackTransactionFacts
): PaystackCheckResult {
  if (payment.provider !== 'PAYSTACK') {
    return { ok: false, reason: 'Payment is not a Paystack payment' };
  }

  const metaPaymentId = transaction.metadata?.paymentId;
  const metaOrderId = transaction.metadata?.orderId;
  const sameRef = Boolean(payment.externalId) && payment.externalId === transaction.reference;

  if (!sameRef && metaPaymentId !== payment.id) {
    return { ok: false, reason: 'Transaction does not belong to this payment' };
  }

  if (metaOrderId && metaOrderId !== payment.orderId) {
    return { ok: false, reason: 'Transaction was created for a different order' };
  }

  if ((transaction.currency ?? '').toLowerCase() !== 'kes') {
    return { ok: false, reason: `Unexpected currency: ${transaction.currency ?? 'none'}` };
  }

  const expected = toPaystackAmount(Number(payment.amount.toString()));
  if (transaction.amount !== expected) {
    return {
      ok: false,
      reason: `Amount mismatch: Paystack reports ${transaction.amount ?? 'none'}, expected ${expected}`,
    };
  }

  return { ok: true };
}
