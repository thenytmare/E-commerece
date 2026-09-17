'use server';

import { loadViewableOrder } from '@/lib/order-access';
import { getOrCreatePendingPayment } from '@/lib/payments/order-payment';
import { buildCallbackUrl, initiateStkPush, normalizeMpesaPhone } from '@/lib/payments/mpesa';
import { createStripeCheckoutSession } from '@/lib/payments/stripe';
import { clientIdentifier, rateLimit, retryMessage } from '@/lib/rate-limit';
import { createRepositories, type OrderDetail } from '@repo/database';
import { isMpesaConfigured, isPaymentDevMode, isStripeConfigured } from '@repo/config';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

export type PaymentActionState = {
  error?: string;
  success?: string;
  /** Set when an STK push was accepted, so the UI can poll for the result. */
  paymentId?: string;
};

async function loadPayableOrder(orderNumber: string): Promise<OrderDetail> {
  const repos = createRepositories();
  // Authorised either by owning account or, for a guest order, this browser's
  // signed cookie — a guest still has to be able to pay for what they ordered.
  const order = await loadViewableOrder(orderNumber);

  if (!order) {
    throw new Error('Order not found');
  }
  if (order.status !== 'PENDING') {
    throw new Error('This order is not awaiting payment');
  }

  const completed = await repos.payment.findCompletedByOrderId(order.id);
  if (completed) {
    throw new Error('This order has already been paid');
  }

  return order;
}

export async function initiateStripePaymentAction(
  orderNumber: string
): Promise<PaymentActionState> {
  // Defense in depth — bounded by provider-side limits already, but nothing
  // stopped a script from hammering this action directly.
  const limit = rateLimit(`stripe-payment:${await clientIdentifier()}`, 10, 5 * 60_000);
  if (!limit.allowed) {
    return { error: retryMessage(limit.retryAfterSeconds) };
  }

  let checkoutUrl: string | undefined;

  try {
    const order = await loadPayableOrder(orderNumber);
    const repos = createRepositories();
    const payment = await getOrCreatePendingPayment(order, 'STRIPE', 'card');

    if (!isStripeConfigured()) {
      if (isPaymentDevMode()) {
        return { error: 'Use dev payment simulation — Stripe keys not configured' };
      }
      return { error: 'Card payments are not available right now' };
    }

    const checkoutSession = await createStripeCheckoutSession(order, payment.id);
    if (!checkoutSession.url) {
      return { error: 'Failed to start Stripe checkout' };
    }

    await repos.payment.updateExternalId(payment.id, checkoutSession.id);
    checkoutUrl = checkoutSession.url;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment failed';
    return { error: message };
  }

  redirect(checkoutUrl);
}

const mpesaPhoneSchema = z.object({
  // Shape check only — normalizeMpesaPhone does the authoritative
  // validation (correct prefix and exact length).
  phone: z.string().trim().min(9, 'Enter a valid Kenyan mobile number'),
});

export async function initiateMpesaPaymentAction(
  _prevState: PaymentActionState | null,
  formData: FormData
): Promise<PaymentActionState> {
  const orderNumber = String(formData.get('orderNumber') ?? '');
  const parsed = mpesaPhoneSchema.safeParse({ phone: formData.get('phone') });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid phone number' };
  }

  // Defense in depth — bounded by provider-side limits already, but nothing
  // stopped a script from hammering this action directly.
  const limit = rateLimit(`mpesa-payment:${await clientIdentifier()}`, 10, 5 * 60_000);
  if (!limit.allowed) {
    return { error: retryMessage(limit.retryAfterSeconds) };
  }

  // Validate the phone before creating any records.
  let phone: string;
  try {
    phone = normalizeMpesaPhone(parsed.data.phone);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid phone number' };
  }

  try {
    if (!isMpesaConfigured()) {
      if (isPaymentDevMode()) {
        return { error: 'Use dev payment simulation — M-Pesa keys not configured' };
      }
      return { error: 'M-Pesa is not available right now' };
    }

    const order = await loadPayableOrder(orderNumber);
    const repos = createRepositories();
    const payment = await getOrCreatePendingPayment(order, 'MPESA', 'stk_push');

    // Amount always comes from the persisted order, never the browser.
    const total =
      typeof order.total === 'object' && 'toNumber' in order.total
        ? order.total.toNumber()
        : Number(order.total);

    const stk = await initiateStkPush({
      phone,
      amount: total,
      orderNumber: order.orderNumber,
      callbackUrl: buildCallbackUrl(),
    });

    await repos.payment.recordStkRequest(payment.id, {
      checkoutRequestId: stk.checkoutRequestId,
      payerPhone: stk.phone,
      metadata: {
        merchantRequestId: stk.merchantRequestId,
        requestedAmount: stk.amount,
        orderTotal: total,
        // Daraja only accepts whole shillings; flag any rounding so
        // reconciliation can spot a charged/ordered mismatch.
        amountRounded: stk.amount !== total,
      },
    });

    revalidatePath(`/orders/${orderNumber}/pay`);
    return {
      success: 'Check your phone and enter your M-Pesa PIN to complete payment.',
      paymentId: payment.id,
    };
  } catch (error) {
    console.error('M-Pesa STK initiation failed', {
      orderNumber,
      error: error instanceof Error ? error.message : 'unknown',
    });
    const message = error instanceof Error ? error.message : 'M-Pesa payment failed';
    return { error: message };
  }
}

export async function simulatePaymentAction(
  orderNumber: string,
  provider: 'STRIPE' | 'MPESA'
): Promise<PaymentActionState> {
  if (!isPaymentDevMode()) {
    return { error: 'Simulated payments are disabled' };
  }

  try {
    const order = await loadPayableOrder(orderNumber);
    const repos = createRepositories();
    const method = provider === 'STRIPE' ? 'card_dev' : 'mpesa_dev';
    const payment = await getOrCreatePendingPayment(order, provider, method);

    await repos.payment.completePayment(payment.id, `dev_${provider.toLowerCase()}_${Date.now()}`, {
      simulated: true,
      provider,
    });

    revalidatePath(`/orders/${orderNumber}`);
    revalidatePath('/account/orders');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Simulation failed';
    return { error: message };
  }

  redirect(`/orders/${orderNumber}?paid=1`);
}
