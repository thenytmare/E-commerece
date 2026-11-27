import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
let config;
vi.mock('@repo/config', () => ({ getPaymentConfig: () => config }));
beforeEach(() => {
  vi.resetModules();
  config = { appUrl: 'http://localhost:3000', mpesaCallbackBaseUrl: 'https://shop.example.com', mpesaCallbackSecret: 'test-secret', mpesaConsumerKey: 'key', mpesaConsumerSecret: 'secret', mpesaShortcode: '123', mpesaPasskey: 'pass', mpesaEnv: 'sandbox' };
});
afterEach(() => vi.unstubAllGlobals());
describe('STK initiation', () => {
  it('uses the public callback origin independently of localhost', async () => {
    const { buildCallbackUrl } = await import('@/lib/payments/mpesa');
    expect(buildCallbackUrl()).toBe('https://shop.example.com/api/webhooks/mpesa/test-secret');
  });
  it.each(['http://localhost:3000', 'https://127.0.0.1', 'https://192.168.1.1', 'invalid'])('rejects an unusable callback address: %s', async origin => {
    config.mpesaCallbackBaseUrl = origin;
    const { buildCallbackUrl } = await import('@/lib/payments/mpesa');
    expect(buildCallbackUrl).toThrow('public HTTPS');
  });
  it('requires provider acceptance, not merely an HTTP 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ access_token: 'token' })).mockResolvedValueOnce(Response.json({ ResponseCode: '1', ResponseDescription: 'Rejected' })));
    const { initiateStkPush, MpesaInitiationError } = await import('@/lib/payments/mpesa');
    await expect(initiateStkPush({ phone: '0712345678', amount: 100, orderNumber: 'ORDER-1', callbackUrl: 'https://shop.example.com/callback' })).rejects.toBeInstanceOf(MpesaInitiationError);
  });
  it('keeps uncertain network outcomes distinct from definite rejection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ access_token: 'token' })).mockRejectedValueOnce(new DOMException('Timed out', 'AbortError')));
    const { initiateStkPush, MpesaInitiationError } = await import('@/lib/payments/mpesa');
    try { await initiateStkPush({ phone: '0712345678', amount: 100, orderNumber: 'ORDER-1', callbackUrl: 'https://shop.example.com/callback' }); throw new Error('Expected failure'); }
    catch (error) { expect(error).not.toBeInstanceOf(MpesaInitiationError); expect(error.message).toMatch(/timed out/); }
  });
  it('returns the reference only after an accepted STK request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ access_token: 'token' })).mockResolvedValueOnce(Response.json({ ResponseCode: '0', CheckoutRequestID: 'request', MerchantRequestID: 'merchant' })));
    const { initiateStkPush } = await import('@/lib/payments/mpesa');
    expect(await initiateStkPush({ phone: '0712345678', amount: 100, orderNumber: 'ORDER-1', callbackUrl: 'https://shop.example.com/callback' })).toMatchObject({ checkoutRequestId: 'request', phone: '254712345678', amount: 100 });
  });
});
