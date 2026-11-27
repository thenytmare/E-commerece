'use server';

import { createRepositories } from '@repo/database';
import { requirePermission } from './auth';
import { getClientIp } from '@/lib/request-context';
import { reportPurchase } from '@/lib/meta-conversions-api';
import { revalidatePath } from 'next/cache';

const repos = createRepositories();

export type ManualPaymentActionState = { success?: boolean; error?: string };

/**
 * Staff verified the customer's M-Pesa code against the real statement and
 * confirmed it. Reuses completePayment so the order is confirmed exactly like
 * an automated gateway callback — same locking, same idempotency, same order
 * state machine — then records who approved it.
 */
export async function confirmManualPaymentAction(
  paymentId: string
): Promise<ManualPaymentActionState> {
  const session = await requirePermission('orders.write');

  const payment = await repos.payment.findById(paymentId);
  if (!payment || payment.provider !== 'MANUAL_MPESA') {
    return { success: false, error: 'Payment not found.' };
  }
  if (payment.status !== 'AWAITING_CONFIRMATION') {
    return { success: false, error: 'This payment is no longer awaiting confirmation.' };
  }

  try {
    await repos.payment.completePayment(paymentId);
    // Manual Paybill has no provider callback, so report the purchase once an
    // authorized staff member has verified the receipt and completed payment.
    // reportPurchase uses the order id as its event id, making retries safe.
    void reportPurchase(payment.orderId);
    await repos.auditLog.create({
      actorId: session.user.id,
      ipAddress: (await getClientIp()) ?? undefined,
      action: 'payment.manual_confirmed',
      entity: 'Payment',
      entityId: paymentId,
      metadata: {
        orderId: payment.orderId,
        receiptNumber: payment.receiptNumber,
        amount: payment.amount.toNumber(),
      },
    });

    revalidatePath('/admin/payments/confirmations');
    revalidatePath('/admin/orders');
    return { success: true };
  } catch (error) {
    console.error('Failed to confirm manual payment:', error);
    const message = error instanceof Error ? error.message : 'Could not confirm this payment.';
    return { success: false, error: message };
  }
}

/**
 * The code did not check out. Marks the submission failed (the order stays
 * PENDING so the customer can resubmit) and records who rejected it and why.
 */
export async function rejectManualPaymentAction(
  paymentId: string,
  reason: string
): Promise<ManualPaymentActionState> {
  const session = await requirePermission('orders.write');

  const trimmed = reason.trim() || 'Payment could not be verified.';

  const payment = await repos.payment.findById(paymentId);
  if (!payment || payment.provider !== 'MANUAL_MPESA') {
    return { success: false, error: 'Payment not found.' };
  }
  if (payment.status !== 'AWAITING_CONFIRMATION') {
    return { success: false, error: 'This payment is no longer awaiting confirmation.' };
  }

  try {
    await repos.payment.rejectManualMpesaPayment(paymentId, trimmed);
    await repos.auditLog.create({
      actorId: session.user.id,
      ipAddress: (await getClientIp()) ?? undefined,
      action: 'payment.manual_rejected',
      entity: 'Payment',
      entityId: paymentId,
      metadata: {
        orderId: payment.orderId,
        receiptNumber: payment.receiptNumber,
        reason: trimmed,
      },
    });

    revalidatePath('/admin/payments/confirmations');
    return { success: true };
  } catch (error) {
    console.error('Failed to reject manual payment:', error);
    const message = error instanceof Error ? error.message : 'Could not reject this payment.';
    return { success: false, error: message };
  }
}
