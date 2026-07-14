import { getPaymentConfig } from '@repo/config';

const SANDBOX_BASE = 'https://sandbox.safaricom.co.ke';
const PRODUCTION_BASE = 'https://api.safaricom.co.ke';

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

/** Normalize Kenyan phone to 254XXXXXXXXX */
export function normalizeMpesaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('254')) {
    return digits;
  }
  if (digits.startsWith('0')) {
    return `254${digits.slice(1)}`;
  }
  if (digits.startsWith('7') || digits.startsWith('1')) {
    return `254${digits}`;
  }
  throw new Error('Enter a valid Kenyan phone number');
}

async function getAccessToken(): Promise<string> {
  const { mpesaConsumerKey, mpesaConsumerSecret } = getCredentials();
  const auth = Buffer.from(`${mpesaConsumerKey}:${mpesaConsumerSecret}`).toString('base64');

  const response = await fetch(`${getBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!response.ok) {
    throw new Error('Failed to authenticate with M-Pesa');
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

export interface StkPushResult {
  checkoutRequestId: string;
  merchantRequestId: string;
}

/** Initiate M-Pesa STK push (Lipa na M-Pesa Online) */
export async function initiateStkPush(params: {
  phone: string;
  amount: number;
  orderNumber: string;
  paymentId: string;
}): Promise<StkPushResult> {
  const { mpesaShortcode, mpesaPasskey, appUrl } = getCredentials();
  const token = await getAccessToken();
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  const password = Buffer.from(`${mpesaShortcode}${mpesaPasskey}${timestamp}`).toString('base64');
  const phone = normalizeMpesaPhone(params.phone);

  const response = await fetch(`${getBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
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
      Amount: Math.ceil(params.amount),
      PartyA: phone,
      PartyB: mpesaShortcode,
      PhoneNumber: phone,
      CallBackURL: `${appUrl}/api/webhooks/mpesa`,
      AccountReference: params.orderNumber,
      TransactionDesc: `TechVault ${params.orderNumber}`,
    }),
  });

  const data = (await response.json()) as {
    CheckoutRequestID?: string;
    MerchantRequestID?: string;
    errorMessage?: string;
  };

  if (!response.ok || !data.CheckoutRequestID) {
    throw new Error(data.errorMessage ?? 'M-Pesa STK push failed');
  }

  return {
    checkoutRequestId: data.CheckoutRequestID,
    merchantRequestId: data.MerchantRequestID ?? data.CheckoutRequestID,
  };
}

export interface MpesaCallbackPayload {
  Body?: {
    stkCallback?: {
      CheckoutRequestID?: string;
      ResultCode?: number;
      ResultDesc?: string;
      CallbackMetadata?: {
        Item?: Array<{ Name?: string; Value?: string | number }>;
      };
    };
  };
}

export function parseMpesaCallback(payload: MpesaCallbackPayload) {
  const callback = payload.Body?.stkCallback;
  if (!callback?.CheckoutRequestID) {
    return null;
  }

  const success = callback.ResultCode === 0;
  const metadata = callback.CallbackMetadata?.Item ?? [];
  const receipt = metadata.find((item) => item.Name === 'MpesaReceiptNumber')?.Value;

  return {
    checkoutRequestId: callback.CheckoutRequestID,
    success,
    resultDesc: callback.ResultDesc,
    receipt: receipt ? String(receipt) : undefined,
  };
}
