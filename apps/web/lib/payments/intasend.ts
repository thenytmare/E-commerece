import { timingSafeEqual } from 'crypto';
import { getPaymentConfig } from '@repo/config';
import { normalizeMpesaPhone, toMpesaAmount } from '@repo/utils';

/**
 * IntaSend M-Pesa prompts (STK push).
 *
 * IntaSend asks the customer's phone for the M-Pesa PIN, then tells us the
 * result in two ways: a webhook, and a status check we can make ourselves.
 * The status check is what we trust. A webhook only tells us to go and look.
 *
 * Endpoints follow IntaSend's own Node library (intasend-node):
 *   POST /api/v1/payment/mpesa-stk-push/   start a prompt
 *   POST /api/v1/payment/status/           ask for the result
 */

const SANDBOX_HOST = 'https://sandbox.intasend.com';
const LIVE_HOST = 'https://payment.intasend.com';

/** Give up on IntaSend calls rather than letting a page hang. */
const INTASEND_TIMEOUT_MS = 15_000;

/** A definite refusal (nothing was sent to the phone), as opposed to an unclear result. */
export class IntasendInitiationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntasendInitiationError';
  }
}

function getCredentials() {
  const config = getPaymentConfig();
  const { intasendPublishableKey, intasendSecretKey, intasendEnv } = config;
  if (!intasendPublishableKey || !intasendSecretKey) {
    throw new Error('IntaSend is not configured');
  }
  // IntaSend test keys contain "_test_" and live keys contain "_live_". Mixing
  // them with the wrong address always fails, so say so clearly instead of a
  // vague 401. Keys without either marker are let through.
  const keys = `${intasendPublishableKey} ${intasendSecretKey}`;
  if (intasendEnv === 'live' && /_test_/i.test(keys)) {
    throw new Error('IntaSend is set to live but the keys are test keys');
  }
  if (intasendEnv !== 'live' && /_live_/i.test(keys)) {
    throw new Error('IntaSend is set to sandbox but the keys are live keys');
  }
  return {
    publishableKey: intasendPublishableKey,
    secretKey: intasendSecretKey,
    host: intasendEnv === 'live' ? LIVE_HOST : SANDBOX_HOST,
  };
}

async function intasendFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), INTASEND_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('M-Pesa request timed out. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export interface IntasendStkResult {
  /** IntaSend's reference for this prompt. Stored the way a Daraja CheckoutRequestID is. */
  invoiceId: string;
  /** Whole shillings sent to IntaSend. */
  amount: number;
  /** The 2547XXXXXXXX number the prompt went to. */
  phone: string;
}

/** Start an M-Pesa prompt on the customer's phone. */
export async function initiateIntasendStk(params: {
  phone: string;
  amount: number;
  /** Our own reference, sent back to us in every webhook. */
  reference: string;
  narrative?: string;
}): Promise<IntasendStkResult> {
  const { publishableKey, secretKey, host } = getCredentials();
  const phone = normalizeMpesaPhone(params.phone);
  const { amount } = toMpesaAmount(params.amount);
  const { appUrl } = getPaymentConfig();

  const response = await intasendFetch(`${host}/api/v1/payment/mpesa-stk-push/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secretKey}`,
      INTASEND_PUBLIC_API_KEY: publishableKey,
    },
    body: JSON.stringify({
      public_key: publishableKey,
      method: 'M-PESA',
      currency: 'KES',
      amount,
      phone_number: phone,
      api_ref: params.reference,
      narrative: params.narrative ?? `Order ${params.reference}`,
      host: appUrl,
    }),
  });

  let data: { invoice?: { invoice_id?: string } } = {};
  try {
    data = (await response.json()) as typeof data;
  } catch {
    // Not JSON. Handled below.
  }
  const invoiceId = data.invoice?.invoice_id;

  if (!response.ok || !invoiceId) {
    console.error('IntaSend STK push failed', { status: response.status });
    const message = 'M-Pesa could not start the payment. Your items are saved. Please try again.';
    // A 4xx means IntaSend refused it, so nothing reached the phone.
    if (response.status >= 400 && response.status < 500) throw new IntasendInitiationError(message);
    throw new Error(
      'M-Pesa has not confirmed whether the prompt was sent. Check your phone and payment status before retrying.'
    );
  }

  return { invoiceId, amount, phone };
}

export type IntasendStatus =
  | { state: 'success'; amount: number | null; receipt?: string; phone?: string }
  | { state: 'failed'; reason: string }
  | { state: 'pending' };

/**
 * Ask IntaSend for the real result of a prompt.
 *
 * Only COMPLETE counts as paid and only FAILED counts as failed. PENDING,
 * PROCESSING and anything we do not recognise stay "pending", so an odd
 * answer can never mark an order paid or lose a real payment.
 */
export async function queryIntasendStatus(invoiceId: string): Promise<IntasendStatus> {
  const { publishableKey, host } = getCredentials();

  const response = await intasendFetch(`${host}/api/v1/payment/status/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      INTASEND_PUBLIC_API_KEY: publishableKey,
    },
    body: JSON.stringify({ invoice_id: invoiceId, public_key: publishableKey }),
  });

  if (!response.ok) return { state: 'pending' };

  const data = (await response.json().catch(() => null)) as {
    invoice?: {
      state?: string;
      value?: string | number;
      account?: string;
      mpesa_reference?: string | null;
      failed_reason?: string | null;
    };
  } | null;
  const invoice = data?.invoice;
  if (!invoice) return { state: 'pending' };

  const state = String(invoice.state ?? '').toUpperCase();
  if (state === 'COMPLETE') {
    const value = Number(invoice.value);
    return {
      state: 'success',
      amount: Number.isFinite(value) ? value : null,
      receipt: typeof invoice.mpesa_reference === 'string' && invoice.mpesa_reference ? invoice.mpesa_reference : undefined,
      phone: typeof invoice.account === 'string' && invoice.account ? invoice.account : undefined,
    };
  }
  if (state === 'FAILED') {
    return { state: 'failed', reason: invoice.failed_reason || 'The M-Pesa payment was not completed.' };
  }
  return { state: 'pending' };
}

/** Does the webhook's challenge match the one we set in the IntaSend dashboard? */
export function intasendChallengeMatches(provided: unknown): boolean {
  const { intasendWebhookChallenge } = getPaymentConfig();
  if (!intasendWebhookChallenge || typeof provided !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(intasendWebhookChallenge);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** The part of a collection webhook we use. */
export interface IntasendWebhookPayload {
  invoice_id?: string;
  state?: string;
  api_ref?: string;
  challenge?: string;
}
