import { NextResponse } from 'next/server';
import { createRepositories } from '@repo/database';
import { verifyPaystackWebhookSignature } from '@/lib/payments/paystack';
import { settlePaystackPayment } from '@/lib/payments/paystack-settlement';

interface PaystackWebhookEvent {
  event?: string;
  data?: {
    id?: number;
    reference?: string;
    status?: string;
    amount?: number;
    currency?: string;
    gateway_response?: string;
    metadata?: {
      paymentId?: string;
      orderId?: string;
      orderNumber?: string;
      [key: string]: unknown;
    };
  };
}

/**
 * Paystack payment webhook endpoint.
 *
 * Configured in Paystack Dashboard under Settings -> API Keys & Webhooks:
 * Webhook URL: https://your-domain/api/webhooks/paystack
 *
 * Paystack signs all webhooks with HMAC SHA-512 of the request body using
 * PAYSTACK_SECRET_KEY in the `x-paystack-signature` header.
 */
export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Cannot read body' }, { status: 400 });
  }

  const signature = request.headers.get('x-paystack-signature');
  if (!signature || !verifyPaystackWebhookSignature(rawBody, signature)) {
    console.warn('Paystack webhook rejected: invalid or missing signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaystackWebhookEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const repos = createRepositories();
  const eventName = event.event;
  const data = event.data;
  const reference = data?.reference;

  if (eventName === 'charge.success' && reference) {
    const paymentId = data?.metadata?.paymentId;
    let payment = paymentId ? await repos.payment.findById(paymentId) : null;

    if (!payment) {
      payment = await repos.payment.findByExternalId(reference, 'PAYSTACK');
    }

    if (payment) {
      try {
        const outcome = await settlePaystackPayment(payment, reference);
        console.info('Paystack webhook processed', {
          paymentId: payment.id,
          orderId: payment.orderId,
          outcome,
        });
      } catch (error) {
        console.error('Paystack webhook settlement failed', {
          paymentId: payment.id,
          reference,
          error: error instanceof Error ? error.message : 'unknown',
        });
      }
    } else {
      console.warn('Paystack webhook for unknown reference/payment', { reference, paymentId });
    }
  }

  // Always return 200 OK so Paystack marks the delivery successful
  return NextResponse.json({ received: true });
}
