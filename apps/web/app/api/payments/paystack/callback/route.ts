import { NextResponse } from 'next/server';
import { createRepositories } from '@repo/database';
import { settlePaystackPayment } from '@/lib/payments/paystack-settlement';
import { getPaymentConfig } from '@repo/config';

/**
 * Browser callback endpoint for Paystack redirects.
 *
 * This handles customer redirects after paying on Paystack:
 * 1. Configured in Paystack Dashboard under Settings -> API Keys & Webhooks -> Callback URL:
 *    https://your-domain.com/api/payments/paystack/callback
 * 2. Also acts as the dynamic callback destination sent during transaction initialization.
 *
 * Paystack appends `?reference=...&trxref=...` to this URL upon redirect.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const reference =
    searchParams.get('reference') ||
    searchParams.get('trxref') ||
    searchParams.get('paystack_ref');
  const { appUrl } = getPaymentConfig();

  if (!reference) {
    return NextResponse.redirect(`${appUrl}/account/orders`);
  }

  const repos = createRepositories();
  const payment = await repos.payment.findByExternalId(reference, 'PAYSTACK');

  if (!payment) {
    console.warn('Paystack callback received for unknown payment reference', { reference });
    return NextResponse.redirect(`${appUrl}/account/orders`);
  }

  const order = await repos.order.findById(payment.orderId);
  if (!order) {
    return NextResponse.redirect(`${appUrl}/account/orders`);
  }

  try {
    const outcome = await settlePaystackPayment(payment, reference);
    if (outcome === 'completed') {
      return NextResponse.redirect(`${appUrl}/orders/${order.orderNumber}?paid=1`);
    }
    if (outcome === 'failed') {
      return NextResponse.redirect(`${appUrl}/orders/${order.orderNumber}/pay?cancelled=1`);
    }
  } catch (error) {
    console.error('Paystack callback settlement failed', {
      orderNumber: order.orderNumber,
      reference,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }

  // If still pending or uncertain, send back to the pay page to let status check or webhook resolve
  return NextResponse.redirect(`${appUrl}/orders/${order.orderNumber}/pay`);
}
