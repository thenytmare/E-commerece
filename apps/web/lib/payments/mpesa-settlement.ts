import { createRepositories, type Payment } from '@repo/database';
import { describeMpesaFailure } from '@repo/utils';
import { queryStkStatus, type ParsedMpesaCallback } from '@/lib/payments/mpesa';

export type SettlementOutcome = 'completed' | 'failed' | 'pending' | 'noop';

/**
 * Settle an M-Pesa payment against Daraja's authoritative result.
 *
 * Safaricom does not sign callbacks, so a callback body is treated only as a
 * *hint that something happened*. The actual state is always re-read from
 * Daraja via STK Query before any money-affecting write. That means a forged
 * callback carrying a real CheckoutRequestID cannot mark an order paid.
 *
 * Shared by the webhook and the reconciliation path so both apply identical
 * rules. Safe to call repeatedly — the repository writes are idempotent.
 */
export async function settleMpesaPayment(
  payment: Payment,
  hint?: ParsedMpesaCallback
): Promise<SettlementOutcome> {
  const repos = createRepositories();

  // Already terminal — nothing to do (duplicate/late callback).
  if (payment.status === 'COMPLETED' || payment.status === 'REFUNDED') {
    return 'noop';
  }

  // Every prompt ever issued for this payment, newest first. A customer who
  // hit "try again" can still approve the earlier prompt on their phone, so
  // all of them are checked before the payment is written off as failed —
  // otherwise a real charge ends up on an order marked FAILED.
  const candidateIds = [
    hint?.checkoutRequestId,
    payment.externalId,
    ...previousRequestIds(payment),
  ].filter((id, index, all): id is string => Boolean(id) && all.indexOf(id) === index);

  if (candidateIds.length === 0) {
    return 'pending';
  }

  type StkVerdict = Awaited<ReturnType<typeof queryStkStatus>>;
  type StkFailure = Extract<StkVerdict, { state: 'failed' }>;
  let sawUnverifiable = false;
  let lastFailure: { id: string; verdict: StkFailure } | null = null;

  for (const checkoutRequestId of candidateIds) {
    let verdict: StkVerdict;
    try {
      verdict = await queryStkStatus(checkoutRequestId);
    } catch (error) {
      // Never settle on an unverified result. Leave PENDING for the next
      // reconciliation attempt.
      console.error('M-Pesa STK query failed', {
        paymentId: payment.id,
        checkoutRequestId,
        error: error instanceof Error ? error.message : 'unknown',
      });
      sawUnverifiable = true;
      continue;
    }

    if (verdict.state === 'success') {
      await repos.payment.completePayment(
        payment.id,
        checkoutRequestId,
        {
          mpesaReceipt: hint?.receipt,
          resultCode: verdict.resultCode,
          resultDesc: verdict.resultDesc,
          verifiedVia: 'stk_query',
          settledRequestId: checkoutRequestId,
        },
        {
          receiptNumber: hint?.receipt,
          payerPhone: hint?.phone,
        }
      );
      return 'completed';
    }

    if (verdict.state === 'failed') {
      lastFailure = { id: checkoutRequestId, verdict };
    } else {
      // Still awaiting the customer on this prompt.
      sawUnverifiable = true;
    }
  }

  // Only conclusive when every prompt was reachable and none succeeded.
  if (lastFailure && !sawUnverifiable) {
    await repos.payment.markFailed(
      payment.id,
      {
        resultCode: lastFailure.verdict.resultCode,
        resultDesc: lastFailure.verdict.resultDesc,
        checkoutRequestId: lastFailure.id,
        verifiedVia: 'stk_query',
      },
      describeMpesaFailure(lastFailure.verdict.resultCode, lastFailure.verdict.resultDesc)
    );
    return 'failed';
  }

  return 'pending';
}

/** CheckoutRequestIDs superseded by a retry — see recordStkRequest. */
function previousRequestIds(payment: Payment): string[] {
  const metadata = (payment.metadata ?? {}) as Record<string, unknown>;
  const recorded = metadata.previousCheckoutRequestIds;
  return Array.isArray(recorded)
    ? recorded.filter((id): id is string => typeof id === 'string')
    : [];
}
