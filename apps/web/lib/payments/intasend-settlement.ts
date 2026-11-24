import { createRepositories, type Payment } from '@repo/database';
import { toMpesaAmount } from '@repo/utils';
import { queryIntasendStatus, type IntasendStatus } from '@/lib/payments/intasend';
import { reportPurchase } from '@/lib/meta-conversions-api';

export type IntasendSettlementOutcome = 'completed' | 'failed' | 'pending' | 'noop';

/** IntaSend payments are stored as M-Pesa payments, marked with this in their metadata. */
export function isIntasendPayment(payment: Pick<Payment, 'metadata'>): boolean {
  const metadata = (payment.metadata ?? {}) as Record<string, unknown>;
  return metadata.gateway === 'intasend';
}

/** What is already stored, kept so the marker and the earlier invoice ids survive a status change. */
function existingMetadata(payment: Payment): Record<string, unknown> {
  return (payment.metadata ?? {}) as Record<string, unknown>;
}

/** Invoice ids from earlier prompts for this payment, kept when a customer tries again. */
function previousInvoiceIds(payment: Payment): string[] {
  const metadata = (payment.metadata ?? {}) as Record<string, unknown>;
  const recorded = metadata.previousCheckoutRequestIds;
  return Array.isArray(recorded)
    ? recorded.filter((id): id is string => typeof id === 'string')
    : [];
}

/**
 * Settle an IntaSend M-Pesa payment against IntaSend's own answer.
 *
 * A webhook body is only a hint that something changed. The result is always
 * read again from IntaSend before any order is marked paid, so a forged
 * webhook cannot confirm an order. The same function runs for the webhook,
 * the checkout page poll and the scheduled reconciliation, so all three
 * follow the same rules. Safe to run again and again.
 */
export async function settleIntasendPayment(
  payment: Payment,
  hintInvoiceId?: string
): Promise<IntasendSettlementOutcome> {
  const repos = createRepositories();

  if (payment.status === 'COMPLETED' || payment.status === 'REFUNDED') {
    return 'noop';
  }

  // Every prompt ever sent for this payment, newest first. A customer who
  // pressed "try again" can still approve the first prompt on their phone, so
  // all of them are checked before the payment is written off as failed.
  const invoiceIds = [hintInvoiceId, payment.externalId, ...previousInvoiceIds(payment)].filter(
    (id, index, all): id is string => Boolean(id) && all.indexOf(id) === index
  );
  if (invoiceIds.length === 0) return 'pending';

  const expected = toMpesaAmount(Number(payment.amount)).amount;
  let sawUnclear = false;
  let lastFailure: { id: string; reason: string } | null = null;

  for (const invoiceId of invoiceIds) {
    let verdict: IntasendStatus;
    try {
      verdict = await queryIntasendStatus(invoiceId);
    } catch (error) {
      // Never settle on a result we could not check. Try again next time.
      console.error('IntaSend status check failed', {
        paymentId: payment.id,
        invoiceId,
        error: error instanceof Error ? error.message : 'unknown',
      });
      sawUnclear = true;
      continue;
    }

    if (verdict.state === 'success') {
      // Less money than the order needs: do not confirm. An admin reviews it.
      if (verdict.amount !== null && verdict.amount < expected) {
        await repos.payment.recordMismatch(payment.id, {
          reason: `IntaSend reported KES ${verdict.amount} but the order needs KES ${expected}`,
          provider: payment.provider,
          externalId: invoiceId,
        });
        sawUnclear = true;
        continue;
      }
      await repos.payment.completePayment(
        payment.id,
        invoiceId,
        {
          ...existingMetadata(payment),
          gateway: 'intasend',
          mpesaReceipt: verdict.receipt,
          paidAmount: verdict.amount,
          verifiedVia: 'intasend_status',
          settledInvoiceId: invoiceId,
        },
        { receiptNumber: verdict.receipt, payerPhone: verdict.phone }
      );
      void reportPurchase(payment.orderId);
      return 'completed';
    }

    if (verdict.state === 'failed') {
      lastFailure = { id: invoiceId, reason: verdict.reason };
    } else {
      sawUnclear = true;
    }
  }

  // Only a clear failure when every prompt was reachable and none succeeded.
  if (lastFailure && !sawUnclear) {
    await repos.payment.markFailed(
      payment.id,
      { ...existingMetadata(payment), gateway: 'intasend', invoiceId: lastFailure.id, verifiedVia: 'intasend_status' },
      lastFailure.reason
    );
    return 'failed';
  }
  return 'pending';
}
