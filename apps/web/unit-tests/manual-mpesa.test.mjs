import { describe, expect, it } from 'vitest';

const { extractMpesaCode } = await import('@/lib/payments/mpesa-code');
const { paymentSettingsSchema, parseFormData } = await import('@/lib/validations/admin');

describe('extractMpesaCode', () => {
  it('reads a code pasted on its own', () => {
    expect(extractMpesaCode('SGH4K8L2MN')).toBe('SGH4K8L2MN');
  });

  it('lowercase input is normalised to upper case', () => {
    expect(extractMpesaCode('sgh4k8l2mn')).toBe('SGH4K8L2MN');
  });

  it('pulls the code out of a full confirmation SMS', () => {
    const sms =
      'SGH4K8L2MN Confirmed. Ksh1,500.00 sent to PRIME ACCESSORIES for account PRIME on 13/11/26 at 2:14 PM.';
    expect(extractMpesaCode(sms)).toBe('SGH4K8L2MN');
  });

  it('ignores a 10-letter word with no digits', () => {
    // "ACCESSORIE" is 10 letters but not a code; the real code has a digit.
    expect(extractMpesaCode('Paid to ACCESSORIE shop, ref QBX12CD9ZZ thanks')).toBe('QBX12CD9ZZ');
  });

  it('returns null when there is no code', () => {
    expect(extractMpesaCode('I have paid please confirm')).toBeNull();
    expect(extractMpesaCode('12345')).toBeNull();
  });

  it('rejects a token that does not start with a letter', () => {
    expect(extractMpesaCode('1GH4K8L2MN')).toBeNull();
  });
});

function paymentForm(fields) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe('paymentSettingsSchema', () => {
  it('accepts a valid enabled configuration', () => {
    const { data, fieldErrors } = parseFormData(
      paymentSettingsSchema,
      paymentForm({ manualMpesaEnabled: 'on', paybillNumber: '400200', accountNumber: 'PRIME' })
    );
    expect(fieldErrors).toBeUndefined();
    expect(data).toMatchObject({
      manualMpesaEnabled: true,
      paybillNumber: '400200',
      accountNumber: 'PRIME',
    });
  });

  it('requires the Paybill number when enabling the method', () => {
    const { fieldErrors } = parseFormData(
      paymentSettingsSchema,
      paymentForm({ manualMpesaEnabled: 'on', accountNumber: 'PRIME' })
    );
    expect(fieldErrors?.paybillNumber).toMatch(/Paybill number/i);
  });

  it('requires the account number when enabling the method', () => {
    const { fieldErrors } = parseFormData(
      paymentSettingsSchema,
      paymentForm({ manualMpesaEnabled: 'on', paybillNumber: '400200' })
    );
    expect(fieldErrors?.accountNumber).toMatch(/account number/i);
  });

  it('rejects a Paybill number that is not 5 to 7 digits', () => {
    const { fieldErrors } = parseFormData(
      paymentSettingsSchema,
      paymentForm({ manualMpesaEnabled: 'on', paybillNumber: '12', accountNumber: 'PRIME' })
    );
    expect(fieldErrors?.paybillNumber).toMatch(/5 to 7 digits/i);
  });

  it('allows saving empty settings while the method stays off', () => {
    const { data, fieldErrors } = parseFormData(paymentSettingsSchema, paymentForm({}));
    expect(fieldErrors).toBeUndefined();
    expect(data).toMatchObject({ manualMpesaEnabled: false, paybillNumber: '', accountNumber: '' });
  });
});
