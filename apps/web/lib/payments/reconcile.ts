import { createRepositories, type Payment } from '@repo/database';
import { settleMpesaPayment } from '@/lib/payments/mpesa-settlement';
import { settleStripePayment } from '@/lib/payments/stripe-settlement';

/**
 * How long a payment may sit PENDING before we re-check it with the provider.
 * Comfortably longer than an STK prompt's own lifetime, so we never interrupt
 * a customer who is still entering their PIN.
 */
const STALE_AFTER_MINUTES = 15;

/**
 * How long an unpaid order may hold reserved stock before it is cancelled.
 * Generous enough for a customer to come back and finish paying, short enough
 * that abandoned carts don't quietly make the store look sold out.
 */
const ABANDON_AFTER_HOURS = 24;

export interface ReconcileSummary {
  checked: number;
  completed: number;
  failed: number;
  stillPending: number;
  ordersCancelled: number;
}

/**
 * Re-check payments whose provider callback never arrived, and release stock
 * held by orders that were never paid for.
 *
 * Nothing called this before: `findStalePending` was written for exactly this
 * job and had no callers, so a customer who closed the tab mid-payment left
 * their stock reserved indefinitely — quietly shrinking real availability with
 * no way for it to ever come back.
 *
 * Safe to run repeatedly: every write it performs is idempotent.
 */
export async function reconcileStalePayments(): Promise<ReconcileSummary> {
  const repos = createRepositories();
  const summary: ReconcileSummary = {
    checked: 0,
    completed: 0,
    failed: 0,
    stillPending: 0,
    ordersCancelled: 0,
  };

  const staleBefore = new Date(Date.now() - STALE_AFTER_MINUTES * 60_000);

  const mpesaPending = await repos.payment.findStalePending('MPESA', staleBefore);
  await settleAll(mpesaPending, settleMpesaPayment, summary);

  // Same passive-webhook-only gap as M-Pesa: if Stripe's webhook delivery is
  // lost, a PENDING payment would otherwise sit forever with nothing to
  // notice it. Settles through the identical completePayment/markFailed
  // repository methods, so this inherits their idempotency for free.
  const stripePending = await repos.payment.findStalePending('STRIPE', staleBefore);
  await settleAll(stripePending, settleStripePayment, summary);

  // Release stock held by orders that were never paid for.
  const abandonedBefore = new Date(Date.now() - ABANDON_AFTER_HOURS * 3_600_000);
  const abandoned = await repos.order.findAbandoned(abandonedBefore);

  for (const order of abandoned) {
    try {
      await repos.order.cancelOrder(
        order.id,
        'Cancelled automatically — payment was never completed'
      );
      summary.ordersCancelled += 1;
    } catch (error) {
      console.error('Failed to cancel abandoned order', {
        orderId: order.id,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  return summary;
}

/**
 * Run a provider's settlement function over a batch of stale payments,
 * tallying the outcome into `summary`. Shared by every provider branch so
 * they all apply identical bookkeeping and error handling.
 */
async function settleAll(
  payments: Payment[],
  settle: (payment: Payment) => Promise<'completed' | 'failed' | 'pending' | 'noop'>,
  summary: ReconcileSummary
): Promise<void> {
  for (const payment of payments) {
    summary.checked += 1;
    try {
      const outcome = await settle(payment);
      if (outcome === 'completed') summary.completed += 1;
      else if (outcome === 'failed') summary.failed += 1;
      else summary.stillPending += 1;
    } catch (error) {
      summary.stillPending += 1;
      console.error('Reconciliation failed for payment', {
        paymentId: payment.id,
        provider: payment.provider,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
}
