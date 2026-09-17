/**
 * Pure M-Pesa/Daraja helpers.
 *
 * Kept free of network and environment access so they can be unit-tested and
 * reused; the HTTP calls live in the web app's payment service.
 */

/** Daraja caps AccountReference at 12 characters. */
export const ACCOUNT_REFERENCE_MAX = 12;

/**
 * Normalize a Kenyan mobile number to Daraja's 2547XXXXXXXX / 2541XXXXXXXX
 * form.
 *
 * Kenyan mobile numbers are exactly 9 digits after the country code and
 * always start 7 or 1. Anything else is rejected rather than silently
 * reshaped into a number that would fail (or worse, reach someone else).
 */
export function normalizeMpesaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  let national: string;
  if (digits.startsWith('254')) {
    national = digits.slice(3);
  } else if (digits.startsWith('0')) {
    national = digits.slice(1);
  } else {
    national = digits;
  }

  if (!/^[71]\d{8}$/.test(national)) {
    throw new Error('Enter a valid Kenyan mobile number (e.g. 0712345678)');
  }

  return `254${national}`;
}

/**
 * Daraja only accepts whole shillings. Returns the integer amount to charge
 * plus whether it differs from the order total, so callers can record the
 * discrepancy instead of silently over- or under-charging.
 */
export function toMpesaAmount(total: number): { amount: number; adjusted: boolean } {
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error('Invalid payment amount');
  }
  const amount = Math.round(total);
  if (amount < 1) {
    throw new Error('Payment amount is below the M-Pesa minimum of KES 1');
  }
  return { amount, adjusted: amount !== total };
}

/**
 * Build a Daraja-safe AccountReference (max 12 chars). Order numbers look
 * like `TV-20260813-A1B2C3` (18 chars), which Daraja rejects, so keep the
 * prefix and random suffix — the part that identifies the order to a human
 * reading their M-Pesa statement.
 */
export function toAccountReference(orderNumber: string): string {
  if (orderNumber.length <= ACCOUNT_REFERENCE_MAX) return orderNumber;

  const parts = orderNumber.split('-');
  const compact = parts.length >= 3 ? `${parts[0]}-${parts[parts.length - 1]}` : orderNumber;
  return compact.slice(0, ACCOUNT_REFERENCE_MAX);
}

export interface MpesaCallbackPayload {
  Body?: {
    stkCallback?: {
      CheckoutRequestID?: string;
      MerchantRequestID?: string;
      ResultCode?: number;
      ResultDesc?: string;
      CallbackMetadata?: {
        Item?: Array<{ Name?: string; Value?: string | number }>;
      };
    };
  };
}

export interface ParsedMpesaCallback {
  checkoutRequestId: string;
  success: boolean;
  resultCode?: number;
  resultDesc?: string;
  receipt?: string;
  phone?: string;
  amount?: number;
}

/**
 * Extract the meaningful fields from a Daraja STK callback.
 *
 * Returns null for anything that isn't a recognisable stkCallback, so the
 * endpoint can acknowledge and ignore junk rather than throwing.
 */
export function parseMpesaCallback(payload: MpesaCallbackPayload): ParsedMpesaCallback | null {
  const callback = payload?.Body?.stkCallback;
  if (!callback?.CheckoutRequestID) {
    return null;
  }

  const metadata = callback.CallbackMetadata?.Item ?? [];
  const pick = (name: string) => metadata.find((item) => item.Name === name)?.Value;

  const receipt = pick('MpesaReceiptNumber');
  const phone = pick('PhoneNumber');
  const amount = pick('Amount');

  return {
    checkoutRequestId: callback.CheckoutRequestID,
    success: callback.ResultCode === 0,
    resultCode: callback.ResultCode,
    resultDesc: callback.ResultDesc,
    receipt: receipt !== undefined ? String(receipt) : undefined,
    phone: phone !== undefined ? String(phone) : undefined,
    amount: amount !== undefined ? Number(amount) : undefined,
  };
}

/** Human-readable reason for admin screens, from Daraja result codes. */
export function describeMpesaFailure(
  resultCode: number | undefined,
  resultDesc: string
): string {
  switch (resultCode) {
    case 1:
      return 'Insufficient M-Pesa balance';
    case 1032:
      return 'Cancelled by customer';
    case 1037:
      return 'Timed out — customer did not respond to the prompt';
    case 2001:
      return 'Incorrect M-Pesa PIN';
    default:
      return resultDesc || 'Payment failed';
  }
}
