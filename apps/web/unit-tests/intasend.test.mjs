import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

let config;
let repo;
vi.mock('@repo/config', () => ({ getPaymentConfig: () => config }));
vi.mock('@repo/database', () => ({ createRepositories: () => repo }));

const keys = { intasendPublishableKey: 'ISPubKey_test_abc', intasendSecretKey: 'ISSecretKey_test_abc', intasendWebhookChallenge: 'long-secret-challenge', intasendEnv: 'sandbox', appUrl: 'https://shop.example.com' };
const invoice = (over) => Response.json({ invoice: { invoice_id: 'INV1', state: 'COMPLETE', value: '1500.00', account: '254712345678', mpesa_reference: 'SGH4K8L2MN', ...over } });

beforeEach(() => {
  vi.resetModules();
  config = { ...keys };
  repo = {
    payment: {
      completePayment: vi.fn(async () => ({})),
      markFailed: vi.fn(async () => ({})),
      recordMismatch: vi.fn(async () => undefined),
      findByStkRequestId: vi.fn(async () => null),
    },
  };
});
afterEach(() => vi.unstubAllGlobals());

const payment = (over = {}) => ({ id: 'pay1', orderId: 'o1', provider: 'MPESA', status: 'PENDING', amount: 1500, externalId: 'INV1', metadata: { gateway: 'intasend' }, ...over });

describe('IntaSend prompt', () => {
  it('sends the prompt to the sandbox address with whole shillings and a 254 number', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ invoice: { invoice_id: 'INV1', state: 'PENDING' } }, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const { initiateIntasendStk } = await import('@/lib/payments/intasend');
    const result = await initiateIntasendStk({ phone: '0712345678', amount: 1499.6, reference: 'TV-1' });
    expect(result).toEqual({ invoiceId: 'INV1', amount: 1500, phone: '254712345678' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://sandbox.intasend.com/api/v1/payment/mpesa-stk-push/');
    expect(JSON.parse(init.body)).toMatchObject({ amount: 1500, phone_number: '254712345678', api_ref: 'TV-1', currency: 'KES' });
    expect(init.headers.Authorization).toBe('Bearer ISSecretKey_test_abc');
  });
  it('uses the live address in live mode', async () => {
    config = { ...keys, intasendEnv: 'live', intasendPublishableKey: 'ISPubKey_live_x', intasendSecretKey: 'ISSecretKey_live_x' };
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ invoice: { invoice_id: 'INV2' } }, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const { initiateIntasendStk } = await import('@/lib/payments/intasend');
    await initiateIntasendStk({ phone: '0712345678', amount: 100, reference: 'TV-2' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://payment.intasend.com/api/v1/payment/mpesa-stk-push/');
  });
  it('refuses test keys in live mode, and live keys in sandbox mode, before calling IntaSend', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    config = { ...keys, intasendEnv: 'live' };
    let mod = await import('@/lib/payments/intasend');
    await expect(mod.initiateIntasendStk({ phone: '0712345678', amount: 100, reference: 'x' })).rejects.toThrow(/test keys/);
    vi.resetModules();
    config = { ...keys, intasendPublishableKey: 'ISPubKey_live_x', intasendSecretKey: 'ISSecretKey_live_x' };
    mod = await import('@/lib/payments/intasend');
    await expect(mod.initiateIntasendStk({ phone: '0712345678', amount: 100, reference: 'x' })).rejects.toThrow(/live keys/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('treats a 4xx as a definite refusal and a 5xx or timeout as unclear', async () => {
    const { initiateIntasendStk, IntasendInitiationError } = await import('@/lib/payments/intasend');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ detail: 'bad' }, { status: 400 })));
    await expect(initiateIntasendStk({ phone: '0712345678', amount: 100, reference: 'x' })).rejects.toBeInstanceOf(IntasendInitiationError);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('oops', { status: 502 })));
    const unclear = await initiateIntasendStk({ phone: '0712345678', amount: 100, reference: 'x' }).catch((e) => e);
    expect(unclear).not.toBeInstanceOf(IntasendInitiationError);
    expect(unclear.message).toMatch(/not confirmed/);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new DOMException('t', 'AbortError')));
    await expect(initiateIntasendStk({ phone: '0712345678', amount: 100, reference: 'x' })).rejects.toThrow(/timed out/);
  });
  it('rejects a bad phone number before calling IntaSend', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { initiateIntasendStk } = await import('@/lib/payments/intasend');
    await expect(initiateIntasendStk({ phone: '12345', amount: 100, reference: 'x' })).rejects.toThrow(/valid Kenyan/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('IntaSend status', () => {
  it.each([['COMPLETE', 'success'], ['FAILED', 'failed'], ['PENDING', 'pending'], ['PROCESSING', 'pending'], ['SOMETHING_NEW', 'pending']])('%s means %s', async (state, expected) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(invoice({ state })));
    const { queryIntasendStatus } = await import('@/lib/payments/intasend');
    expect((await queryIntasendStatus('INV1')).state).toBe(expected);
  });
  it('is pending when IntaSend errors or sends nonsense', async () => {
    const { queryIntasendStatus } = await import('@/lib/payments/intasend');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('x', { status: 500 })));
    expect((await queryIntasendStatus('INV1')).state).toBe('pending');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ hello: 'world' })));
    expect((await queryIntasendStatus('INV1')).state).toBe('pending');
  });
  it('checks the webhook challenge exactly', async () => {
    const { intasendChallengeMatches } = await import('@/lib/payments/intasend');
    expect(intasendChallengeMatches('long-secret-challenge')).toBe(true);
    expect(intasendChallengeMatches('long-secret-challengX')).toBe(false);
    expect(intasendChallengeMatches('short')).toBe(false);
    expect(intasendChallengeMatches(undefined)).toBe(false);
    expect(intasendChallengeMatches(12345)).toBe(false);
  });
});

describe('IntaSend settlement', () => {
  it('confirms a payment only after IntaSend says COMPLETE, and keeps the receipt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(invoice({})));
    const { settleIntasendPayment } = await import('@/lib/payments/intasend-settlement');
    expect(await settleIntasendPayment(payment())).toBe('completed');
    const [id, ext, meta, details] = repo.payment.completePayment.mock.calls[0];
    expect([id, ext]).toEqual(['pay1', 'INV1']);
    expect(meta).toMatchObject({ gateway: 'intasend', verifiedVia: 'intasend_status' });
    expect(details).toMatchObject({ receiptNumber: 'SGH4K8L2MN', payerPhone: '254712345678' });
  });
  it('does not trust a webhook that says COMPLETE when IntaSend says PENDING', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(invoice({ state: 'PENDING' })));
    const { settleIntasendPayment } = await import('@/lib/payments/intasend-settlement');
    expect(await settleIntasendPayment(payment(), 'INV1')).toBe('pending');
    expect(repo.payment.completePayment).not.toHaveBeenCalled();
    expect(repo.payment.markFailed).not.toHaveBeenCalled();
  });
  it('does not confirm when less money was paid than the order needs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(invoice({ value: '10.00' })));
    const { settleIntasendPayment } = await import('@/lib/payments/intasend-settlement');
    expect(await settleIntasendPayment(payment())).toBe('pending');
    expect(repo.payment.completePayment).not.toHaveBeenCalled();
    expect(repo.payment.recordMismatch).toHaveBeenCalledOnce();
  });
  it('fails a payment only when every prompt has clearly failed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(invoice({ state: 'FAILED', failed_reason: 'Request cancelled by user' })));
    const { settleIntasendPayment } = await import('@/lib/payments/intasend-settlement');
    expect(await settleIntasendPayment(payment())).toBe('failed');
    expect(repo.payment.markFailed.mock.calls[0][2]).toBe('Request cancelled by user');
    expect(repo.payment.markFailed.mock.calls[0][1]).toMatchObject({ gateway: 'intasend' });
  });
  it('keeps waiting if an earlier prompt is still open, and finds a late success on it', async () => {
    const earlier = payment({ externalId: 'INV2', metadata: { gateway: 'intasend', previousCheckoutRequestIds: ['INV1'] } });
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(invoice({ invoice_id: 'INV2', state: 'FAILED' }))
      .mockResolvedValueOnce(invoice({ invoice_id: 'INV1', state: 'PENDING' })));
    const { settleIntasendPayment } = await import('@/lib/payments/intasend-settlement');
    expect(await settleIntasendPayment(earlier)).toBe('pending');
    expect(repo.payment.markFailed).not.toHaveBeenCalled();
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(invoice({ state: 'FAILED' }))
      .mockResolvedValueOnce(invoice({ invoice_id: 'INV1', state: 'COMPLETE' })));
    expect(await settleIntasendPayment(earlier)).toBe('completed');
    expect(repo.payment.completePayment.mock.calls[0][1]).toBe('INV1');
  });
  it('leaves the payment alone when IntaSend cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const { settleIntasendPayment } = await import('@/lib/payments/intasend-settlement');
    expect(await settleIntasendPayment(payment())).toBe('pending');
    expect(repo.payment.markFailed).not.toHaveBeenCalled();
  });
  it('does nothing for a payment that is already paid', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { settleIntasendPayment } = await import('@/lib/payments/intasend-settlement');
    expect(await settleIntasendPayment(payment({ status: 'COMPLETED' }))).toBe('noop');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('is picked by the M-Pesa settlement only for payments marked as IntaSend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(invoice({})));
    const { settleMpesaPayment } = await import('@/lib/payments/mpesa-settlement');
    expect(await settleMpesaPayment(payment())).toBe('completed');
    expect(repo.payment.completePayment.mock.calls[0][2]).toMatchObject({ gateway: 'intasend' });
  });
});

describe('IntaSend webhook route', () => {
  const post = async (body) => {
    const { POST } = await import('@/app/api/webhooks/intasend/route');
    return POST(new Request('https://shop.example.com/api/webhooks/intasend', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }));
  };
  it('refuses a wrong or missing challenge with a 404 and does no work', async () => {
    expect((await post({ invoice_id: 'INV1', state: 'COMPLETE', challenge: 'nope' })).status).toBe(404);
    expect((await post({ invoice_id: 'INV1', state: 'COMPLETE' })).status).toBe(404);
    expect(repo.payment.findByStkRequestId).not.toHaveBeenCalled();
  });
  it('rejects a body that is not JSON', async () => {
    expect((await post('not json')).status).toBe(400);
  });
  it('acknowledges events with no invoice, and invoices we do not know', async () => {
    expect((await post({ challenge: 'long-secret-challenge', tracking_id: 'x' })).status).toBe(200);
    expect((await post({ challenge: 'long-secret-challenge', invoice_id: 'NOPE', state: 'COMPLETE' })).status).toBe(200);
  });
  it('ignores a payment that did not go through IntaSend', async () => {
    repo.payment.findByStkRequestId.mockResolvedValue(payment({ metadata: {} }));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await post({ challenge: 'long-secret-challenge', invoice_id: 'INV1', state: 'COMPLETE' })).status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('settles from IntaSend’s own answer and always replies 200', async () => {
    repo.payment.findByStkRequestId.mockResolvedValue(payment());
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(invoice({})));
    expect((await post({ challenge: 'long-secret-challenge', invoice_id: 'INV1', state: 'COMPLETE' })).status).toBe(200);
    expect(repo.payment.completePayment).toHaveBeenCalledOnce();
    // A forged COMPLETE does nothing when IntaSend says otherwise.
    repo.payment.completePayment.mockClear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(invoice({ state: 'PENDING' })));
    expect((await post({ challenge: 'long-secret-challenge', invoice_id: 'INV1', state: 'COMPLETE' })).status).toBe(200);
    expect(repo.payment.completePayment).not.toHaveBeenCalled();
    // A crash on our side still returns 200, so IntaSend does not switch the webhook off.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(invoice({})));
    repo.payment.completePayment.mockRejectedValueOnce(new Error('db down'));
    expect((await post({ challenge: 'long-secret-challenge', invoice_id: 'INV1', state: 'COMPLETE' })).status).toBe(200);
  });
});
