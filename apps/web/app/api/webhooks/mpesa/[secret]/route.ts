import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { getPaymentConfig } from '@repo/config';
import { createRepositories } from '@repo/database';
import { parseMpesaCallback, type MpesaCallbackPayload } from '@/lib/payments/mpesa';
import { settleMpesaPayment } from '@/lib/payments/mpesa-settlement';

/**
 * Daraja STK Push callback.
 *
 * Safaricom provides no request signing, so this endpoint is protected by
 * two independent layers:
 *
 *  1. A high-entropy secret embedded in the URL path (MPESA_CALLBACK_SECRET),
 *     known only to Safaricom because we supply it in the CallBackURL.
 *  2. Server-side verification via Daraja's STK Query API before any
 *     money-affecting write — see settleMpesaPayment().
 *
 * Layer 2 is what actually makes the result trustworthy: even a caller who
 * learned the secret and a real CheckoutRequestID cannot mark an order paid,
 * because the outcome is re-read from Safaricom rather than taken from the
 * request body.
 *
 * Always responds 200 {ResultCode: 0} once the secret checks out, per
 * Daraja's contract — a non-200 makes Safaricom retry indefinitely.
 */

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, so length-check first.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ secret: string }> }
) {
  const { secret } = await params;
  const { mpesaCallbackSecret } = getPaymentConfig();

  if (!mpesaCallbackSecret) {
    console.error('M-Pesa callback received but MPESA_CALLBACK_SECRET is not configured');
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (!secretMatches(secret, mpesaCallbackSecret)) {
    console.warn('M-Pesa callback rejected: invalid path secret');
    // Deliberately a 404 — do not reveal that a callback endpoint exists here.
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let payload: MpesaCallbackPayload;
  try {
    payload = (await request.json()) as MpesaCallbackPayload;
  } catch {
    console.warn('M-Pesa callback rejected: malformed JSON body');
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const parsed = parseMpesaCallback(payload);
  if (!parsed) {
    console.warn('M-Pesa callback ignored: unrecognised payload shape');
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  const repos = createRepositories();
  // Matches superseded CheckoutRequestIDs too, so a prompt the customer
  // approved after retrying still resolves to its payment.
  const payment = await repos.payment.findByStkRequestId(parsed.checkoutRequestId);

  if (!payment) {
    // Unknown transaction — acknowledge so Safaricom stops retrying, but log
    // it: this is either a stale request or something worth investigating.
    console.warn('M-Pesa callback for unknown transaction', {
      checkoutRequestId: parsed.checkoutRequestId,
    });
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  try {
    const outcome = await settleMpesaPayment(payment, parsed);
    console.info('M-Pesa callback processed', {
      paymentId: payment.id,
      orderId: payment.orderId,
      outcome,
    });
  } catch (error) {
    // Swallow and acknowledge: retrying will not help if our own write
    // failed, and the reconciliation path will pick this payment up.
    console.error('M-Pesa callback processing failed', {
      paymentId: payment.id,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }

  return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
}
