import { describe, expect, it } from 'vitest';
import {
  describeMpesaFailure,
  normalizeMpesaPhone,
  parseMpesaCallback,
  toAccountReference,
  toMpesaAmount,
  type MpesaCallbackPayload,
} from './mpesa';

describe('normalizeMpesaPhone', () => {
  it.each([
    ['0712345678', '254712345678'],
    ['0112345678', '254112345678'],
    ['254712345678', '254712345678'],
    ['+254712345678', '254712345678'],
    ['712345678', '254712345678'],
    ['112345678', '254112345678'],
    ['0712 345 678', '254712345678'],
    ['+254 712-345-678', '254712345678'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeMpesaPhone(input)).toBe(expected);
  });

  // These all silently produced bogus numbers before validation was added.
  it.each([
    ['7', 'too short'],
    ['254', 'country code only'],
    ['071234567800', 'too long'],
    ['0812345678', 'invalid 08 prefix'],
    ['0612345678', 'invalid 06 prefix'],
    ['', 'empty'],
    ['abc', 'non-numeric'],
    ['25471234567', 'one digit short'],
  ])('rejects %s (%s)', (input) => {
    expect(() => normalizeMpesaPhone(input)).toThrow();
  });
});

describe('toMpesaAmount', () => {
  it('passes whole shillings through unchanged', () => {
    expect(toMpesaAmount(34999)).toEqual({ amount: 34999, adjusted: false });
  });

  it('rounds to nearest shilling and flags the adjustment', () => {
    // Previously Math.ceil, which overcharged the customer.
    expect(toMpesaAmount(34999.4)).toEqual({ amount: 34999, adjusted: true });
    expect(toMpesaAmount(34999.6)).toEqual({ amount: 35000, adjusted: true });
  });

  it.each([[0], [-100], [NaN], [Infinity]])('rejects invalid amount %s', (value) => {
    expect(() => toMpesaAmount(value)).toThrow();
  });

  it('rejects amounts that round below the KES 1 minimum', () => {
    expect(() => toMpesaAmount(0.4)).toThrow(/minimum/i);
  });
});

describe('toAccountReference', () => {
  it('shortens order numbers beyond the 12-char Daraja limit', () => {
    const ref = toAccountReference('TV-20260813-A1B2C3');
    expect(ref).toBe('TV-A1B2C3');
    expect(ref.length).toBeLessThanOrEqual(12);
  });

  it('leaves already-short references untouched', () => {
    expect(toAccountReference('TV-A1B2C3')).toBe('TV-A1B2C3');
  });

  it('always respects the limit even for unexpected formats', () => {
    const ref = toAccountReference('THIS-IS-A-VERY-LONG-ORDER-NUMBER-INDEED');
    expect(ref.length).toBeLessThanOrEqual(12);
  });
});

describe('parseMpesaCallback', () => {
  const successPayload = {
    Body: {
      stkCallback: {
        MerchantRequestID: 'merchant-1',
        CheckoutRequestID: 'ws_CO_123',
        ResultCode: 0,
        ResultDesc: 'The service request is processed successfully.',
        CallbackMetadata: {
          Item: [
            { Name: 'Amount', Value: 34999 },
            { Name: 'MpesaReceiptNumber', Value: 'SFF1ABCDEF' },
            { Name: 'PhoneNumber', Value: 254712345678 },
          ],
        },
      },
    },
  };

  it('extracts receipt, phone and amount from a successful callback', () => {
    const parsed = parseMpesaCallback(successPayload);
    expect(parsed).toMatchObject({
      checkoutRequestId: 'ws_CO_123',
      success: true,
      receipt: 'SFF1ABCDEF',
      phone: '254712345678',
      amount: 34999,
    });
  });

  it('marks a non-zero ResultCode as unsuccessful', () => {
    const parsed = parseMpesaCallback({
      Body: {
        stkCallback: {
          CheckoutRequestID: 'ws_CO_456',
          ResultCode: 1032,
          ResultDesc: 'Request cancelled by user',
        },
      },
    });
    expect(parsed?.success).toBe(false);
    expect(parsed?.resultCode).toBe(1032);
    expect(parsed?.receipt).toBeUndefined();
  });

  it.each([
    ['empty object', {}],
    ['missing stkCallback', { Body: {} }],
    ['missing CheckoutRequestID', { Body: { stkCallback: {} } }],
  ])('returns null for malformed payload: %s', (_label, payload) => {
    expect(parseMpesaCallback(payload as MpesaCallbackPayload)).toBeNull();
  });
});

describe('describeMpesaFailure', () => {
  it.each([
    [1032, 'Cancelled by customer'],
    [1, 'Insufficient M-Pesa balance'],
    [1037, 'Timed out — customer did not respond to the prompt'],
    [2001, 'Incorrect M-Pesa PIN'],
  ])('maps result code %s to a readable reason', (code, expected) => {
    expect(describeMpesaFailure(code, 'raw desc')).toBe(expected);
  });

  it('falls back to the provider description for unknown codes', () => {
    expect(describeMpesaFailure(9999, 'Some provider text')).toBe('Some provider text');
  });

  it('falls back to a generic message when there is no description', () => {
    expect(describeMpesaFailure(undefined, '')).toBe('Payment failed');
  });
});
