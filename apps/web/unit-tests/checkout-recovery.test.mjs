import { beforeEach, describe, expect, it, vi } from 'vitest';
const loadViewableOrder = vi.fn();
const restoreUnpaidToCart = vi.fn();
const getOrCreateActiveCart = vi.fn();
const settleMpesaPayment = vi.fn();
const claimProviderQuery = vi.fn();
vi.mock('@/lib/order-access', () => ({ loadViewableOrder }));
vi.mock('@/lib/cart', () => ({ getOrCreateActiveCart }));
vi.mock('@/lib/payments/mpesa-settlement', () => ({ settleMpesaPayment }));
vi.mock('@/lib/rate-limit', () => ({ clientIdentifier: async () => 'visitor', rateLimit: async () => ({ allowed: true }), retryMessage: () => 'Wait' }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@repo/database', () => ({ createRepositories: () => ({ order: { restoreUnpaidToCart }, payment: { claimProviderQuery } }) }));
const { restoreCheckoutAction } = await import('@/lib/actions/checkout-recovery');
beforeEach(() => { vi.clearAllMocks(); loadViewableOrder.mockResolvedValue({ id: 'owned-order', payments: [] }); getOrCreateActiveCart.mockResolvedValue({ id: 'own-cart' }); restoreUnpaidToCart.mockResolvedValue(undefined); claimProviderQuery.mockResolvedValue(true); });
describe('checkout recovery action', () => {
  it('does not touch carts or orders without ownership proof', async () => {
    loadViewableOrder.mockResolvedValue(null);
    expect(await restoreCheckoutAction('foreign-order')).toEqual({ error: 'Order not found.' });
    expect(getOrCreateActiveCart).not.toHaveBeenCalled(); expect(restoreUnpaidToCart).not.toHaveBeenCalled();
  });
  it('uses only the authenticated visitor’s destination cart', async () => {
    expect(await restoreCheckoutAction('owned-order')).toEqual({ success: true });
    expect(restoreUnpaidToCart).toHaveBeenCalledWith('owned-order', 'own-cart');
  });
  it('rechecks an unresolved STK before attempting recovery', async () => {
    const payment = { id: 'payment', provider: 'MPESA', status: 'PENDING', externalId: 'request' };
    loadViewableOrder.mockResolvedValue({ id: 'owned-order', payments: [payment] });
    restoreUnpaidToCart.mockRejectedValue(new Error('Payment is still being checked.'));
    expect(await restoreCheckoutAction('owned-order')).toEqual({ error: 'Payment is still being checked.' });
    expect(settleMpesaPayment).toHaveBeenCalledWith(payment);
    expect(settleMpesaPayment.mock.invocationCallOrder[0]).toBeLessThan(restoreUnpaidToCart.mock.invocationCallOrder[0]);
  });
});
