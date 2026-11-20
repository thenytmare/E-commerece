import { describe, expect, it } from 'vitest';
import { checkStripeSession, toStripeAmount } from './stripe-amount';

const payment = {
  id: 'pay-1',
  orderId: 'order-1',
  provider: 'STRIPE',
  externalId: 'cs_1',
  amount: { toString: () => '1500.00' },
};

const goodSession = {
  id: 'cs_1',
  currency: 'kes',
  amount_total: 150000,
  metadata: { paymentId: 'pay-1', orderId: 'order-1' },
};

describe('toStripeAmount', () => {
  it('sends KES in cents: KSh 1,500 is 150000', () => {
    expect(toStripeAmount(1500)).toBe(150000);
  });
  it('handles fractional shillings without float drift', () => {
    expect(toStripeAmount(1.15)).toBe(115);
    expect(toStripeAmount(0.1 + 0.2)).toBe(30);
    expect(toStripeAmount(999.99)).toBe(99999);
  });
});

describe('checkStripeSession', () => {
  it('accepts the right session, currency and amount', () => {
    expect(checkStripeSession(payment, goodSession)).toEqual({ ok: true });
  });
  it('rejects an undercharge (the old KES 15 bug)', () => {
    const result = checkStripeSession(payment, { ...goodSession, amount_total: 1500 });
    expect(result.ok).toBe(false);
  });
  it('rejects the wrong currency', () => {
    expect(checkStripeSession(payment, { ...goodSession, currency: 'usd' }).ok).toBe(false);
  });
  it('rejects a session that belongs to another payment', () => {
    const other = { ...goodSession, id: 'cs_other', metadata: { paymentId: 'pay-2', orderId: 'order-1' } };
    expect(checkStripeSession(payment, other).ok).toBe(false);
  });
  it('rejects a session created for a different order', () => {
    const other = { ...goodSession, metadata: { paymentId: 'pay-1', orderId: 'order-2' } };
    expect(checkStripeSession(payment, other).ok).toBe(false);
  });
  it('still accepts an older session of the same payment (retry overwrote externalId)', () => {
    const late = { ...payment, externalId: 'cs_2' };
    expect(checkStripeSession(late, goodSession)).toEqual({ ok: true });
  });
  it('rejects a payment that is not a Stripe payment', () => {
    expect(checkStripeSession({ ...payment, provider: 'MPESA' }, goodSession).ok).toBe(false);
  });
});
