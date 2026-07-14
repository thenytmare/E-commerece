'use server';

import { requireAuth } from '@/lib/actions/auth';
import { getOrCreatePendingPayment } from '@/lib/payments/order-payment';
import { initiateStkPush, normalizeMpesaPhone } from '@/lib/payments/mpesa';
import { createStripeCheckoutSession } from '@/lib/payments/stripe';
import { createRepositories, type OrderDetail } from '@repo/database';
import { isMpesaConfigured, isPaymentDevMode, isStripeConfigured } from '@repo/config';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

export type PaymentActionState = {
  error?: string;
  success?: string;
};

async function loadPayableOrder(orderNumber: string): Promise<OrderDetail> {
  const session = await requireAuth();
  const repos = createRepositories();
  const order = await repos.order.findByOrderNumberForUser(orderNumber, session.user.id);

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
  phone: z.string().min(10, 'Enter a valid phone number'),
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

  try {
    const order = await loadPayableOrder(orderNumber);
    const repos = createRepositories();
    const payment = await getOrCreatePendingPayment(order, 'MPESA', 'stk_push');

    if (!isMpesaConfigured()) {
      if (isPaymentDevMode()) {
        return { error: 'Use dev payment simulation — M-Pesa keys not configured' };
      }
      return { error: 'M-Pesa is not available right now' };
    }

    const total =
      typeof order.total === 'object' && 'toNumber' in order.total
        ? order.total.toNumber()
        : Number(order.total);

    const stk = await initiateStkPush({
      phone: normalizeMpesaPhone(parsed.data.phone),
      amount: total,
      orderNumber: order.orderNumber,
      paymentId: payment.id,
    });

    await repos.payment.updateExternalId(payment.id, stk.checkoutRequestId);

    revalidatePath(`/orders/${orderNumber}/pay`);
    return {
      success: 'STK push sent. Enter your M-Pesa PIN on your phone to complete payment.',
    };
  } catch (error) {
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
