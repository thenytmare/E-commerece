import { createRepositories, type Payment } from '@repo/database';
import { retrieveStripeCheckoutSession } from '@/lib/payments/stripe';

export type SettlementOutcome = 'completed' | 'failed' | 'pending' | 'noop';

/**
 * Settle a Stripe payment against Stripe's authoritative Checkout Session
 * status.
 *
 * Unlike M-Pesa, Stripe webhooks are signed, so there is no forgery concern
 * here — but a webhook delivery can still be lost entirely, leaving a
 * payment PENDING with nothing to notice it. This re-reads the session
 * straight from Stripe before any money-affecting write, using the exact
 * same `payment_status` / `status` checks the webhook route applies, and
 * settles through the same idempotent completePayment/markFailed repository
 * methods the webhook uses. That means calling this for a payment the
 * webhook already settled is a safe no-op, and calling it repeatedly for one
 * that is still genuinely in progress just leaves it PENDING.
 */
export async function settleStripePayment(payment: Payment): Promise<SettlementOutcome> {
  const repos = createRepositories();

  // Already terminal — nothing to do (webhook arrived late, or twice).
  if (payment.status === 'COMPLETED' || payment.status === 'REFUNDED') {
    return 'noop';
  }

  if (!payment.externalId) {
    return 'pending';
  }

  let session;
  try {
    session = await retrieveStripeCheckoutSession(payment.externalId);
  } catch (error) {
    // Never settle on an unverified result. Leave PENDING for the next
    // reconciliation attempt.
    console.error('Stripe session retrieval failed', {
      paymentId: payment.id,
      sessionId: payment.externalId,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return 'pending';
  }

  // Mirrors checkout.session.completed / async_payment_succeeded: `paid` is
  // the only payment_status that confirms money actually settled.
  if (session.payment_status === 'paid') {
    await repos.payment.completePayment(payment.id, session.id, {
      stripeSessionId: session.id,
      paymentStatus: session.payment_status,
      verifiedVia: 'session_retrieve',
    });
    return 'completed';
  }

  // Mirrors checkout.session.expired: once expired, this session can never
  // be paid, so the payment is conclusively failed.
  if (session.status === 'expired') {
    await repos.payment.markFailed(
      payment.id,
      {
        stripeSessionId: session.id,
        stripeStatus: session.status,
        paymentStatus: session.payment_status,
        verifiedVia: 'session_retrieve',
      },
      'Checkout session expired before payment was completed.'
    );
    return 'failed';
  }

  // Still open (or completed with an async payment method whose money
  // hasn't settled yet) — wait for the next reconciliation pass.
  return 'pending';
}
