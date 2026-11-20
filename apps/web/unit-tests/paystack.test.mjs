import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';

let config;
let repo;
vi.mock('@repo/config', () => ({
  getPaymentConfig: () => config,
  toPaystackAmount: (kes) => Math.round(kes * 100),
  checkPaystackTransaction: (payment, transaction) => {
    if (payment.provider !== 'PAYSTACK') return { ok: false, reason: 'Not PAYSTACK' };
    if ((transaction.currency ?? '').toLowerCase() !== 'kes') return { ok: false, reason: 'Bad currency' };
    const expected = Math.round(Number(payment.amount.toString()) * 100);
    if (transaction.amount !== expected) return { ok: false, reason: 'Amount mismatch' };
    return { ok: true };
  },
}));
vi.mock('@repo/database', () => ({ createRepositories: () => repo }));

const keys = {
  paystackSecretKey: 'sk_test_1234567890abcdef',
  paystackPublicKey: 'pk_test_abcdef1234567890',
  appUrl: 'https://shop.example.com',
};

beforeEach(() => {
  vi.resetModules();
  config = { ...keys };
  repo = {
    payment: {
      completePayment: vi.fn(async () => ({})),
      markFailed: vi.fn(async () => ({})),
      recordMismatch: vi.fn(async () => undefined),
      findByExternalId: vi.fn(async () => null),
      findById: vi.fn(async () => null),
    },
  };
});
afterEach(() => vi.unstubAllGlobals());

const payment = (over = {}) => ({
  id: 'pay1',
  orderId: 'o1',
  provider: 'PAYSTACK',
  status: 'PENDING',
  amount: 1500,
  externalId: 'ps_ORD-1_123',
  metadata: {},
  ...over,
});

describe('Paystack transaction initialization', () => {
  it('calls Paystack API with proper Authorization header, subunits amount, and returns checkout url', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      Response.json({
        status: true,
        message: 'Authorization url created',
        data: {
          authorization_url: 'https://checkout.paystack.com/auth-code-123',
          access_code: 'auth-code-123',
          reference: 'ps_ORD-1_123',
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { initializePaystackTransaction } = await import('@/lib/payments/paystack');
    const order = {
      id: 'o1',
      orderNumber: 'ORD-1',
      total: 1500,
      guestEmail: 'guest@example.com',
    };

    const result = await initializePaystackTransaction({ order, paymentId: 'pay1' });
    expect(result.authorizationUrl).toBe('https://checkout.paystack.com/auth-code-123');
    expect(result.reference).toBe('ps_ORD-1_123');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.paystack.co/transaction/initialize');
    expect(init.headers.Authorization).toBe('Bearer sk_test_1234567890abcdef');
    const body = JSON.parse(init.body);
    expect(body.amount).toBe(150000); // 1500 * 100
    expect(body.email).toBe('guest@example.com');
    expect(body.currency).toBe('KES');
  });

  it('throws PaystackInitiationError on API failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        Response.json(
          { status: false, message: 'Invalid API key' },
          { status: 401 }
        )
      )
    );

    const { initializePaystackTransaction, PaystackInitiationError } = await import(
      '@/lib/payments/paystack'
    );
    const order = { id: 'o1', orderNumber: 'ORD-1', total: 100 };
    await expect(
      initializePaystackTransaction({ order, paymentId: 'pay1' })
    ).rejects.toBeInstanceOf(PaystackInitiationError);
  });
});

describe('Paystack webhook signature verification', () => {
  it('correctly validates valid HMAC-SHA512 signatures', async () => {
    const { verifyPaystackWebhookSignature } = await import('@/lib/payments/paystack');
    const rawBody = JSON.stringify({ event: 'charge.success', data: { id: 123 } });
    const signature = crypto
      .createHmac('sha512', keys.paystackSecretKey)
      .update(rawBody)
      .digest('hex');

    expect(verifyPaystackWebhookSignature(rawBody, signature)).toBe(true);
    expect(verifyPaystackWebhookSignature(rawBody, 'wrong-signature')).toBe(false);
    expect(verifyPaystackWebhookSignature(rawBody, null)).toBe(false);
  });
});

describe('Paystack settlement', () => {
  it('completes payment when Paystack reports success', async () => {
    const mockTransaction = {
      status: true,
      data: {
        id: 999,
        status: 'success',
        reference: 'ps_ORD-1_123',
        amount: 150000,
        currency: 'KES',
        channel: 'mobile_money',
        customer: { phone: '+254712345678' },
        paid_at: '2026-11-20T03:00:00.000Z',
        gateway_response: 'Successful',
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json(mockTransaction)));

    const { settlePaystackPayment } = await import('@/lib/payments/paystack-settlement');
    const outcome = await settlePaystackPayment(payment());

    expect(outcome).toBe('completed');
    expect(repo.payment.completePayment).toHaveBeenCalledWith(
      'pay1',
      'ps_ORD-1_123',
      expect.objectContaining({
        paystackId: 999,
        channel: 'mobile_money',
        verifiedVia: 'paystack_verify',
      }),
      { receiptNumber: 'ps_ORD-1_123', payerPhone: '+254712345678' }
    );
  });

  it('marks payment failed when Paystack reports failed transaction', async () => {
    const mockTransaction = {
      status: true,
      data: {
        id: 999,
        status: 'failed',
        reference: 'ps_ORD-1_123',
        amount: 150000,
        currency: 'KES',
        gateway_response: 'Insufficient funds',
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json(mockTransaction)));

    const { settlePaystackPayment } = await import('@/lib/payments/paystack-settlement');
    const outcome = await settlePaystackPayment(payment());

    expect(outcome).toBe('failed');
    expect(repo.payment.markFailed).toHaveBeenCalledWith(
      'pay1',
      expect.objectContaining({
        lastReference: 'ps_ORD-1_123',
        verifiedVia: 'paystack_verify',
      }),
      'Insufficient funds'
    );
  });

  it('returns noop if payment is already COMPLETED', async () => {
    const { settlePaystackPayment } = await import('@/lib/payments/paystack-settlement');
    const outcome = await settlePaystackPayment(payment({ status: 'COMPLETED' }));
    expect(outcome).toBe('noop');
  });
});

describe('Paystack webhook route', () => {
  const postWebhook = async (body, signature) => {
    const { POST } = await import('@/app/api/webhooks/paystack/route');
    const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
    const headers = new Headers();
    if (signature) headers.set('x-paystack-signature', signature);
    return POST(
      new Request('https://shop.example.com/api/webhooks/paystack', {
        method: 'POST',
        headers,
        body: rawBody,
      })
    );
  };

  it('rejects missing or invalid signature with 400', async () => {
    const res = await postWebhook({ event: 'charge.success' }, 'bad_sig');
    expect(res.status).toBe(400);
  });

  it('processes charge.success and settles payment', async () => {
    const event = {
      event: 'charge.success',
      data: {
        reference: 'ps_ORD-1_123',
        metadata: { paymentId: 'pay1' },
      },
    };
    const rawBody = JSON.stringify(event);
    const sig = crypto.createHmac('sha512', keys.paystackSecretKey).update(rawBody).digest('hex');

    repo.payment.findById.mockResolvedValueOnce(payment());

    // Mock the verify API call that settlePaystackPayment will make:
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        Response.json({
          status: true,
          data: {
            id: 111,
            status: 'success',
            reference: 'ps_ORD-1_123',
            amount: 150000,
            currency: 'KES',
            channel: 'card',
          },
        })
      )
    );

    const res = await postWebhook(rawBody, sig);
    expect(res.status).toBe(200);
    expect(repo.payment.completePayment).toHaveBeenCalled();
  });
});

describe('Paystack browser callback route', () => {
  it('redirects to /orders/[orderNumber]?paid=1 when payment is completed', async () => {
    const { GET } = await import('@/app/api/payments/paystack/callback/route');
    repo.payment.findByExternalId.mockResolvedValueOnce(payment());
    repo.order = {
      findById: vi.fn().mockResolvedValueOnce({ id: 'o1', orderNumber: 'ORD-1' }),
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        Response.json({
          status: true,
          data: {
            id: 111,
            status: 'success',
            reference: 'ps_ORD-1_123',
            amount: 150000,
            currency: 'KES',
          },
        })
      )
    );

    const res = await GET(
      new Request('https://shop.example.com/api/payments/paystack/callback?reference=ps_ORD-1_123')
    );

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://shop.example.com/orders/ORD-1?paid=1');
  });

  it('redirects to account/orders if reference is missing', async () => {
    const { GET } = await import('@/app/api/payments/paystack/callback/route');
    const res = await GET(
      new Request('https://shop.example.com/api/payments/paystack/callback')
    );

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://shop.example.com/account/orders');
  });
});
