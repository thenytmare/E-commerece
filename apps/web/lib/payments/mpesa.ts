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

// Daraja tokens last about an hour. Keep one in memory and reuse it, instead of
// asking for a new one on every single STK query.
let cachedToken: { value: string; expiresAt: number } | null = null;
const TOKEN_SAFETY_MS = 60_000;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }
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

  const data = (await response.json()) as { access_token?: string; expires_in?: string | number };
  if (!data.access_token) {
    throw new Error('Failed to authenticate with M-Pesa');
  }
  const lifetimeMs = (Number(data.expires_in) || 3599) * 1000;
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(0, lifetimeMs - TOKEN_SAFETY_MS),
  };
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

/** A definite rejection can be retried/restored; a network timeout is uncertain. */
export class MpesaInitiationError extends Error {
  constructor(message: string) { super(message); this.name = 'MpesaInitiationError'; }
}

/** Initiate M-Pesa STK push (Lipa na M-Pesa Online) */
export async function initiateStkPush(params: {
  phone: string;
  amount: number;
  orderNumber: string;
  callbackUrl: string;
}): Promise<StkPushResult> {
  const { mpesaShortcode, mpesaPasskey } = getCredentials();
  const token = await getAccessToken().catch(() => { throw new MpesaInitiationError('Could not connect to M-Pesa. No prompt was sent. Please try again.'); });
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
    ResponseCode?: string | number;
  };

  if (!response.ok || String(data.ResponseCode) !== '0' || !data.CheckoutRequestID) {
    // Log the provider detail server-side; return a safe message to the user.
    console.error('M-Pesa STK push failed', {
      status: response.status,
      errorMessage: data.errorMessage,
      responseDescription: data.ResponseDescription,
    });
    const message = 'M-Pesa could not start the payment. Your items are saved. Please try again.';
    if (response.status < 500 && !data.CheckoutRequestID) throw new MpesaInitiationError(message);
    throw new Error('M-Pesa has not confirmed whether the prompt was sent. Check your phone and payment status before retrying.');
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

  // Some Daraja responses describe a transaction that hasn't actually
  // concluded yet — e.g. ResultDesc "The transaction is still under
  // processing" — but arrive as an ordinary 200 response with a non-zero
  // ResultCode, not the 500.001.1001 HTTP-error shape handled above. Marking
  // that terminal-failed tells the customer "payment not completed" in the
  // same breath as text saying it's still in progress. Recognise the same
  // not-yet-decided language here too, so it stays 'pending' — the caller
  // (settleMpesaPayment) already checks every outstanding prompt again on
  // the next reconciliation pass, and the storefront poller already has a
  // dedicated "still waiting" state for exactly this case.
  if (/\bstill\b[\s\S]*?\bprocess|being\s+processed/i.test(resultDesc)) {
    return { state: 'pending', resultDesc: resultDesc || 'Awaiting M-Pesa confirmation' };
  }

  return { state: 'failed', resultCode, resultDesc };
}

/** Path Safaricom posts results to, including the shared path secret. */
export function buildCallbackUrl(): string {
  const { appUrl, mpesaCallbackSecret, mpesaCallbackBaseUrl } = getPaymentConfig();
  if (!mpesaCallbackSecret) {
    throw new Error('MPESA_CALLBACK_SECRET is not configured');
  }
  let base: URL;
  try { base = new URL(mpesaCallbackBaseUrl || appUrl); }
  catch { throw new Error('M-Pesa is temporarily unavailable. The store needs a public HTTPS callback address.'); }
  if (base.protocol !== 'https:' || base.hostname === 'localhost' || base.hostname.endsWith('.localhost') || /^(127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(base.hostname) || base.hostname.includes(':') || base.username || base.password) {
    throw new Error('M-Pesa is temporarily unavailable. The store needs a public HTTPS callback address.');
  }
  return `${base.origin}/api/webhooks/mpesa/${encodeURIComponent(mpesaCallbackSecret)}`;
}
