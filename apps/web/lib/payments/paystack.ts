import { timingSafeEqual, createHmac } from 'crypto';
import { getPaymentConfig, toPaystackAmount } from '@repo/config';
import type { OrderDetail } from '@repo/database';

const PAYSTACK_API_BASE = 'https://api.paystack.co';
const PAYSTACK_TIMEOUT_MS = 15_000;

export class PaystackInitiationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaystackInitiationError';
  }
}

function getCredentials() {
  const config = getPaymentConfig();
  const { paystackSecretKey, paystackPublicKey } = config;
  if (!paystackSecretKey) {
    throw new Error('Paystack is not configured');
  }
  return {
    secretKey: paystackSecretKey,
    publicKey: paystackPublicKey,
  };
}

async function paystackFetch(endpoint: string, init?: RequestInit): Promise<Response> {
  const { secretKey } = getCredentials();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAYSTACK_TIMEOUT_MS);

  try {
    return await fetch(`${PAYSTACK_API_BASE}${endpoint}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secretKey}`,
        ...init?.headers,
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Paystack request timed out. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function orderTotalKes(order: OrderDetail): number {
  return typeof order.total === 'object' && 'toNumber' in order.total
    ? order.total.toNumber()
    : Number(order.total);
}

export interface PaystackInitResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

/**
 * Initialize a Paystack transaction and receive the hosted checkout URL.
 */
export async function initializePaystackTransaction(params: {
  order: OrderDetail;
  paymentId: string;
  callbackUrl?: string;
}): Promise<PaystackInitResult> {
  const { appUrl } = getPaymentConfig();
  const total = orderTotalKes(params.order);
  const amount = toPaystackAmount(total);
  const reference = `ps_${params.order.orderNumber}_${Date.now()}`;
  const email =
    params.order.guestEmail ||
    params.order.user?.email ||
    `order-${params.order.orderNumber}@primeaccessorieskenya.co.ke`;

  const callbackUrl =
    params.callbackUrl ??
    `${appUrl}/api/payments/paystack/callback?reference=${reference}`;

  const payload = {
    email,
    amount,
    currency: 'KES',
    reference,
    callback_url: callbackUrl,
    metadata: {
      orderId: params.order.id,
      orderNumber: params.order.orderNumber,
      paymentId: params.paymentId,
      custom_fields: [
        {
          display_name: 'Order Number',
          variable_name: 'order_number',
          value: params.order.orderNumber,
        },
      ],
    },
  };

  const response = await paystackFetch('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  let data: {
    status?: boolean;
    message?: string;
    data?: {
      authorization_url?: string;
      access_code?: string;
      reference?: string;
    };
  } = {};

  try {
    data = (await response.json()) as typeof data;
  } catch {
    // Non-JSON response handled below
  }

  const authUrl = data.data?.authorization_url;
  const accessCode = data.data?.access_code;
  const returnedRef = data.data?.reference || reference;

  if (!response.ok || !data.status || !authUrl || !accessCode) {
    console.error('Paystack transaction initialization failed', {
      status: response.status,
      message: data.message,
    });
    throw new PaystackInitiationError(
      data.message || 'Could not start Paystack checkout. Please try again.'
    );
  }

  return {
    authorizationUrl: authUrl,
    accessCode,
    reference: returnedRef,
  };
}

export interface PaystackTransactionData {
  id: number;
  domain: string;
  status: 'success' | 'failed' | 'abandoned' | string;
  reference: string;
  amount: number;
  message: string | null;
  gateway_response: string;
  paid_at: string | null;
  created_at: string;
  channel: string;
  currency: string;
  ip_address?: string;
  metadata?: {
    orderId?: string;
    orderNumber?: string;
    paymentId?: string;
    [key: string]: unknown;
  };
  customer?: {
    id?: number;
    email?: string;
    phone?: string | null;
  };
  authorization?: {
    authorization_code?: string;
    bin?: string;
    last4?: string;
    exp_month?: string;
    exp_year?: string;
    channel?: string;
    card_type?: string;
    bank?: string;
  };
}

/**
 * Ask Paystack for the authoritative state of a transaction by its reference.
 */
export async function verifyPaystackTransaction(
  reference: string
): Promise<PaystackTransactionData | null> {
  const response = await paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
  });

  if (!response.ok) {
    return null;
  }

  try {
    const json = (await response.json()) as {
      status?: boolean;
      data?: PaystackTransactionData;
    };
    if (json.status && json.data) {
      return json.data;
    }
  } catch {
    // Parsing error
  }

  return null;
}

/**
 * Validates the HMAC SHA-512 signature of a Paystack webhook request.
 */
export function verifyPaystackWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  if (!signature) return false;
  const { paystackSecretKey } = getPaymentConfig();
  if (!paystackSecretKey) return false;

  const expected = createHmac('sha512', paystackSecretKey).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);

  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
