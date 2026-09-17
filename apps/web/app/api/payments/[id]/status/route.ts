import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createRepositories } from '@repo/database';
import { settleMpesaPayment } from '@/lib/payments/mpesa-settlement';
import { canAccessGuestOrder } from '@/lib/guest-orders';

/**
 * Payment status for the checkout page to poll after an STK push.
 *
 * Ownership-scoped: a payment is only visible to the user who owns the
 * underlying order or a guest holding a valid signed order cookie, so
 * payment ids are not enumerable across accounts.
 *
 * Doubles as the reconciliation trigger — if a PENDING M-Pesa payment has had
 * time to settle but no callback arrived, this asks Daraja directly. That is
 * what stops payments sitting PENDING forever when Safaricom's callback is
 * lost, without needing a background worker.
 */

/** Give the customer time to enter their PIN before querying Daraja. */
const RECONCILE_AFTER_MS = 10_000;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repos = createRepositories();

  const payment = await repos.payment.findById(id);
  if (!payment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const order = await repos.order.findById(payment.orderId);
  if (!order) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Ownership check: the order behind this payment must belong to the logged-in
  // user or to a guest holding the signed cookie for this specific order.
  const session = await auth();
  const isOwnedByUser = Boolean(session?.user?.id && order.userId === session.user.id);
  const isGuestWithCookie = order.userId === null && (await canAccessGuestOrder(order.orderNumber));

  if (!isOwnedByUser && !isGuestWithCookie) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let current = payment;

  const isStale = Date.now() - payment.createdAt.getTime() > RECONCILE_AFTER_MS;
  if (payment.status === 'PENDING' && payment.provider === 'MPESA' && isStale) {
    try {
      const outcome = await settleMpesaPayment(payment);
      if (outcome === 'completed' || outcome === 'failed') {
        current = (await repos.payment.findById(id)) ?? payment;
      }
    } catch (error) {
      // Polling must not 500 just because Daraja is unreachable.
      console.error('M-Pesa reconciliation during status poll failed', {
        paymentId: id,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  const terminal = current.status === 'COMPLETED' || current.status === 'FAILED';

  return NextResponse.json({
    id: current.id,
    status: current.status,
    provider: current.provider,
    // Safe to expose to the owning customer; no provider internals.
    receiptNumber: current.receiptNumber,
    failureReason: current.failureReason,
    orderNumber: order.orderNumber,
    terminal,
  });
}
