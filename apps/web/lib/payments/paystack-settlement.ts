import { createRepositories, type Payment } from '@repo/database';
import { checkPaystackTransaction } from '@repo/config';
import {
  verifyPaystackTransaction,
  type PaystackTransactionData,
} from '@/lib/payments/paystack';
import { reportPurchase } from '@/lib/meta-conversions-api';

export type PaystackSettlementOutcome = 'completed' | 'failed' | 'pending' | 'noop';

function existingMetadata(payment: Payment): Record<string, unknown> {
  return (payment.metadata ?? {}) as Record<string, unknown>;
}

function previousReferences(payment: Payment): string[] {
  const metadata = existingMetadata(payment);
  const recorded = metadata.previousReferences;
  return Array.isArray(recorded)
    ? recorded.filter((id): id is string => typeof id === 'string')
    : [];
}

/**
 * Settle a Paystack payment against Paystack's authoritative verify API.
 *
 * Webhook delivery or customer return URL gives a hint. The result is always
 * re-read from Paystack directly before marking an order paid, ensuring no
 * forged or mismatched transaction confirms an order. Safe to call repeatedly.
 */
export async function settlePaystackPayment(
  payment: Payment,
  hintReference?: string
): Promise<PaystackSettlementOutcome> {
  const repos = createRepositories();

  if (payment.status === 'COMPLETED' || payment.status === 'REFUNDED') {
    return 'noop';
  }

  const references = [
    hintReference,
    payment.externalId,
    ...previousReferences(payment),
  ].filter((ref, idx, all): ref is string => Boolean(ref) && all.indexOf(ref) === idx);

  if (references.length === 0) {
    return 'pending';
  }

  let sawUnclear = false;
  let lastFailure: { id: string; reason: string } | null = null;

  for (const reference of references) {
    let transaction: PaystackTransactionData | null;
    try {
      transaction = await verifyPaystackTransaction(reference);
    } catch (error) {
      console.error('Paystack verification request failed', {
        paymentId: payment.id,
        reference,
        error: error instanceof Error ? error.message : 'unknown',
      });
      sawUnclear = true;
      continue;
    }

    if (!transaction) {
      sawUnclear = true;
      continue;
    }

    if (transaction.status === 'success') {
      const check = checkPaystackTransaction(payment, transaction);
      if (!check.ok) {
        console.error('Paystack transaction failed verification check', {
          paymentId: payment.id,
          reference,
          reason: check.reason,
        });
        await repos.payment.recordMismatch(payment.id, {
          reason: check.reason,
          provider: 'PAYSTACK',
          externalId: reference,
        });
        sawUnclear = true;
        continue;
      }

      const receiptNumber =
        transaction.reference ||
        (transaction.authorization?.last4
          ? `Card •••• ${transaction.authorization.last4}`
          : String(transaction.id));
      const payerPhone = transaction.customer?.phone ?? undefined;

      await repos.payment.completePayment(
        payment.id,
        reference,
        {
          ...existingMetadata(payment),
          paystackId: transaction.id,
          channel: transaction.channel,
          paidAt: transaction.paid_at,
          gatewayResponse: transaction.gateway_response,
          verifiedVia: 'paystack_verify',
          settledReference: reference,
        },
        { receiptNumber, payerPhone }
      );
      void reportPurchase(payment.orderId);
      return 'completed';
    }

    if (transaction.status === 'failed') {
      lastFailure = {
        id: reference,
        reason: transaction.gateway_response || 'The payment was not completed.',
      };
    } else {
      // 'abandoned' or 'pending'
      sawUnclear = true;
    }
  }

  if (lastFailure && !sawUnclear) {
    await repos.payment.markFailed(
      payment.id,
      {
        ...existingMetadata(payment),
        lastReference: lastFailure.id,
        verifiedVia: 'paystack_verify',
      },
      lastFailure.reason
    );
    return 'failed';
  }

  return 'pending';
}
