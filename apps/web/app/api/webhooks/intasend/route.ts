import { NextResponse } from 'next/server';
import { createRepositories } from '@repo/database';
import { intasendChallengeMatches, type IntasendWebhookPayload } from '@/lib/payments/intasend';
import { isIntasendPayment, settleIntasendPayment } from '@/lib/payments/intasend-settlement';

/**
 * IntaSend payment webhook.
 *
 * In the IntaSend dashboard you give this address and a "challenge" text.
 * IntaSend sends the challenge back in every request, and we only listen to
 * requests that carry the right one. That is the first lock.
 *
 * The second lock matters more: the body is never trusted. We note which
 * invoice it names, then ask IntaSend directly for the real result before any
 * order is marked paid (see settleIntasendPayment). A forged request, even one
 * that guessed the challenge, cannot confirm an order.
 *
 * Once the challenge checks out we always answer 200. IntaSend switches a
 * webhook off after 20 failed deliveries in a row, so a problem on our side
 * must never look like a failure to them. The scheduled reconciliation picks
 * up anything we could not settle here.
 */
export async function POST(request: Request) {
  let payload: IntasendWebhookPayload;
  try {
    payload = (await request.json()) as IntasendWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  if (!payload || typeof payload !== 'object' || !intasendChallengeMatches(payload.challenge)) {
    console.warn('IntaSend webhook rejected: wrong or missing challenge');
    // A 404, so nobody learns that this address does anything.
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Other event types (payouts, chargebacks) share the same address but have
  // no invoice for a shop payment. Acknowledge and ignore them.
  const invoiceId = typeof payload.invoice_id === 'string' ? payload.invoice_id : '';
  if (!invoiceId) {
    return NextResponse.json({ received: true });
  }

  const repos = createRepositories();
  const payment = await repos.payment.findByStkRequestId(invoiceId);
  if (!payment || !isIntasendPayment(payment)) {
    console.warn('IntaSend webhook for an unknown invoice', { invoiceId });
    return NextResponse.json({ received: true });
  }

  try {
    const outcome = await settleIntasendPayment(payment, invoiceId);
    console.info('IntaSend webhook processed', {
      paymentId: payment.id,
      orderId: payment.orderId,
      outcome,
    });
  } catch (error) {
    console.error('IntaSend webhook processing failed', {
      paymentId: payment.id,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }

  return NextResponse.json({ received: true });
}
