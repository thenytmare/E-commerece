import { getPaymentConfig } from '@repo/config';
import {
  normalizeMpesaPhone,
  toAccountReference,
  toMpesaAmount,
  parseMpesaCallback,
  describeMpesaFailure,
  type MpesaCallbackPayload,
  type ParsedMpesaCallback,
} from '@repo/utils';

// Pure helpers live in @repo/utils so they can be unit-tested; re-exported
// here so payment code has a single M-Pesa import site.
export {
  normalizeMpesaPhone,
  toAccountReference,
  toMpesaAmount,
  parseMpesaCallback,
  describeMpesaFailure,
};
export type { MpesaCallbackPayload, ParsedMpesaCallback };

const SANDBOX_BASE = 'https://sandbox.safaricom.co.ke';
const PRODUCTION_BASE = 'https://api.safaricom.co.ke';

/** Abort Daraja calls rather than letting a server action hang indefinitely. */
const DARAJA_TIMEOUT_MS = 15_000;

function getBaseUrl(): string {
  const { mpesaEnv } = getPaymentConfig();
  return mpesaEnv === 'production' ? PRODUCTION_BASE : SANDBOX_BASE;
}

function getCredentials() {
  const config = getPaymentConfig();
  if (
    !config.mpesaConsumerKey ||
    !config.mpesaConsumerSecret ||
    !config.mpesaShortcode ||
    !config.mpesaPasskey
  ) {
    throw new Error('M-Pesa is not configured');
  }
  return config;
}

/** fetch with an enforced timeout, so Safaricom outages fail fast. */
async function darajaFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DARAJA_TIMEOUT_MS);
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

async function getAccessToken(): Promise<string> {
  const { mpesaConsumerKey, mpesaConsumerSecret } = getCredentials();
  const auth = Buffer.from(`${mpesaConsumerKey}:${mpesaConsumerSecret}`).toString('base64');

  const response = await darajaFetch(
    `${getBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );

  if (!response.ok) {
    console.error('M-Pesa OAuth failed', { status: response.status });
    throw new Error('Failed to authenticate with M-Pesa');
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('Failed to authenticate with M-Pesa');
  }
  return data.access_token;
}

/** Daraja password + timestamp pair used by both STK Push and STK Query. */
function buildPassword(shortcode: string, passkey: string) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
  return { password, timestamp };
}

export interface StkPushResult {
  checkoutRequestId: string;
  merchantRequestId: string;
  /** Integer amount actually sent to Daraja. */
  amount: number;
  /** Normalized 2547XXXXXXXX number the prompt was sent to. */
  phone: string;
}

/** Initiate M-Pesa STK push (Lipa na M-Pesa Online) */
export async function initiateStkPush(params: {
  phone: string;
  amount: number;
  orderNumber: string;
  callbackUrl: string;
}): Promise<StkPushResult> {
  const { mpesaShortcode, mpesaPasskey } = getCredentials();
  const token = await getAccessToken();
  const { password, timestamp } = buildPassword(mpesaShortcode!, mpesaPasskey!);
  const phone = normalizeMpesaPhone(params.phone);
  const { amount } = toMpesaAmount(params.amount);

  const response = await darajaFetch(`${getBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: mpesaShortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: mpesaShortcode,
      PhoneNumber: phone,
      CallBackURL: params.callbackUrl,
      AccountReference: toAccountReference(params.orderNumber),
      TransactionDesc: `Order ${toAccountReference(params.orderNumber)}`,
    }),
  });

  const data = (await response.json()) as {
    CheckoutRequestID?: string;
    MerchantRequestID?: string;
    errorMessage?: string;
    ResponseDescription?: string;
  };

  if (!response.ok || !data.CheckoutRequestID) {
    // Log the provider detail server-side; return a safe message to the user.
    console.error('M-Pesa STK push failed', {
      status: response.status,
      errorMessage: data.errorMessage,
      responseDescription: data.ResponseDescription,
    });
    throw new Error(
      data.errorMessage ?? 'Could not reach M-Pesa right now. Please try again.'
    );
  }

  return {
    checkoutRequestId: data.CheckoutRequestID,
    merchantRequestId: data.MerchantRequestID ?? data.CheckoutRequestID,
    amount,
    phone,
  };
}

export type StkQueryOutcome =
  | { state: 'success'; resultCode: number; resultDesc: string }
  | { state: 'failed'; resultCode: number; resultDesc: string }
  | { state: 'pending'; resultDesc: string };

/**
 * Ask Daraja for the authoritative result of an STK push.
 *
 * This is what makes the callback trustworthy: Safaricom does not sign
 * callbacks, so a result is only acted on once Daraja itself confirms it.
 * Also used to reconcile payments whose callback never arrived.
 *
 * `pending` means Daraja has not settled the transaction yet (or the query
 * itself failed) — the caller must NOT treat that as either outcome.
 */
export async function queryStkStatus(checkoutRequestId: string): Promise<StkQueryOutcome> {
  const { mpesaShortcode, mpesaPasskey } = getCredentials();
  const token = await getAccessToken();
  const { password, timestamp } = buildPassword(mpesaShortcode!, mpesaPasskey!);

  const response = await darajaFetch(`${getBaseUrl()}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: mpesaShortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
  });

  const data = (await response.json()) as {
    ResultCode?: string | number;
    ResultDesc?: string;
    errorCode?: string;
    errorMessage?: string;
  };

  // Daraja returns 500.001.1001 ("transaction is being processed") while the
  // customer still has the prompt open — that is genuinely undecided.
  if (!response.ok || data.ResultCode === undefined) {
    return {
      state: 'pending',
      resultDesc: data.errorMessage ?? data.ResultDesc ?? 'Awaiting M-Pesa confirmation',
    };
  }

  const resultCode = Number(data.ResultCode);
  const resultDesc = data.ResultDesc ?? '';

  if (Number.isNaN(resultCode)) {
    return { state: 'pending', resultDesc: resultDesc || 'Awaiting M-Pesa confirmation' };
  }
  if (resultCode === 0) {
    return { state: 'success', resultCode, resultDesc };
  }
  return { state: 'failed', resultCode, resultDesc };
}

/** Path Safaricom posts results to, including the shared path secret. */
export function buildCallbackUrl(): string {
  const { appUrl, mpesaCallbackSecret } = getPaymentConfig();
  if (!mpesaCallbackSecret) {
    throw new Error('MPESA_CALLBACK_SECRET is not configured');
  }
  return `${appUrl.replace(/\/$/, '')}/api/webhooks/mpesa/${mpesaCallbackSecret}`;
}
