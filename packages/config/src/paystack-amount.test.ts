import { describe, expect, it } from 'vitest';
import {
  checkPaystackTransaction,
  toPaystackAmount,
  type PaystackPaymentRecord,
  type PaystackTransactionFacts,
} from './paystack-amount';

describe('toPaystackAmount', () => {
  it('converts whole shillings to cents', () => {
    expect(toPaystackAmount(1500)).toBe(150000);
    expect(toPaystackAmount(100)).toBe(10000);
  });

  it('rounds fractional cents cleanly', () => {
    expect(toPaystackAmount(1499.55)).toBe(149955);
    expect(toPaystackAmount(1499.554)).toBe(149955);
    expect(toPaystackAmount(1499.556)).toBe(149956);
  });
});

describe('checkPaystackTransaction', () => {
  const basePayment: PaystackPaymentRecord = {
    id: 'pay_123',
    orderId: 'ord_456',
    provider: 'PAYSTACK',
    externalId: 'ref_789',
    amount: { toString: () => '1500' },
  };

  const baseTransaction: PaystackTransactionFacts = {
    id: 9999,
    reference: 'ref_789',
    currency: 'KES',
    amount: 150000,
    metadata: {
      paymentId: 'pay_123',
      orderId: 'ord_456',
    },
  };

  it('accepts matching payment and transaction', () => {
    const res = checkPaystackTransaction(basePayment, baseTransaction);
    expect(res).toEqual({ ok: true });
  });

  it('accepts transaction if externalId is matched even without metadata paymentId', () => {
    const res = checkPaystackTransaction(basePayment, {
      ...baseTransaction,
      metadata: null,
    });
    expect(res).toEqual({ ok: true });
  });

  it('rejects if provider is not PAYSTACK', () => {
    const res = checkPaystackTransaction({ ...basePayment, provider: 'STRIPE' }, baseTransaction);
    expect(res.ok).toBe(false);
  });

  it('rejects if currency is not KES', () => {
    const res = checkPaystackTransaction(basePayment, { ...baseTransaction, currency: 'USD' });
    expect(res.ok).toBe(false);
  });

  it('rejects if amount does not match', () => {
    const res = checkPaystackTransaction(basePayment, { ...baseTransaction, amount: 10000 });
    expect(res.ok).toBe(false);
  });

  it('rejects if transaction was created for a different order', () => {
    const res = checkPaystackTransaction(basePayment, {
      ...baseTransaction,
      metadata: { orderId: 'different_order' },
    });
    expect(res.ok).toBe(false);
  });
});
