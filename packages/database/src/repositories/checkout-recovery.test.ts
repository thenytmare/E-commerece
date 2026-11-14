import { describe, it, expect, vi } from 'vitest';
import { OrderRepository } from './order.repository';
import { PaymentRepository } from './payment.repository';

function fixture() {
  const order = { id: 'order', status: 'PENDING', cartRestoredAt: null as Date | null, items: [{ variantId: 'v1', name: 'Cable', quantity: 2 }], payments: [] as { status: string }[] };
  const tx = {
    $queryRaw: vi.fn(),
    order: { findUniqueOrThrow: vi.fn(async () => order), update: vi.fn(async ({ data }) => Object.assign(order, data)), findMany: vi.fn() },
    cart: { update: vi.fn() },
    productVariant: { findFirst: vi.fn().mockResolvedValue({ id: 'v1' }) },
    inventory: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUnique: vi.fn().mockResolvedValue({ quantity: 10, reserved: 0 }) },
    cartItem: { findUnique: vi.fn().mockResolvedValue({ quantity: 1 }), upsert: vi.fn() },
    orderStatusHistory: { create: vi.fn() },
    payment: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'payment' }) },
  };
  const db = { ...tx, $transaction: (fn: (value: typeof tx) => unknown) => fn(tx) };
  return { order, tx, repo: new OrderRepository(db as never), payments: new PaymentRepository(db as never) };
}
describe('unpaid checkout recovery', () => {
  it('restores quantities without overwriting new cart items and releases stock once', async () => {
    const { repo, tx } = fixture();
    await repo.restoreUnpaidToCart('order', 'cart');
    await repo.restoreUnpaidToCart('order', 'cart');
    expect(tx.inventory.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.cartItem.upsert).toHaveBeenCalledTimes(1);
    expect(tx.cartItem.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { quantity: { increment: 2 } } }));
    expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'CANCELLED', cartRestoredAt: expect.any(Date) } }));
  });
  it.each(['COMPLETED', 'REFUNDED', 'PENDING'])('does not restore while a payment is %s', async status => {
    const { repo, tx, order } = fixture(); order.payments = [{ status }];
    await expect(repo.restoreUnpaidToCart('order', 'cart')).rejects.toThrow();
    expect(tx.cartItem.upsert).not.toHaveBeenCalled(); expect(tx.inventory.updateMany).not.toHaveBeenCalled();
  });
  it('allows a terminal failed payment to be restored', async () => {
    const { repo, tx, order } = fixture(); order.payments = [{ status: 'FAILED' }];
    await repo.restoreUnpaidToCart('order', 'cart'); expect(tx.cartItem.upsert).toHaveBeenCalledTimes(1);
  });
  it('does not release reservations a second time for a cancelled order', async () => {
    const { repo, tx, order } = fixture(); order.status = 'CANCELLED';
    await repo.restoreUnpaidToCart('order', 'cart'); expect(tx.inventory.updateMany).not.toHaveBeenCalled();
  });
  it('stops when stock cannot accommodate restored and existing items', async () => {
    const { repo, tx } = fixture(); tx.inventory.findUnique.mockResolvedValue({ quantity: 1, reserved: 0 });
    await expect(repo.restoreUnpaidToCart('order', 'cart')).rejects.toThrow('Not enough stock'); expect(tx.cartItem.upsert).not.toHaveBeenCalled();
  });
  it('returns no orders when there is no ownership proof', async () => {
    const { repo, tx } = fixture(); expect(await repo.findRecoverableCheckouts({ guestOrderNumbers: [] })).toEqual([]);
    expect(tx.order.findMany).not.toHaveBeenCalled();
  });
  it('prevents initiating payment after recovery cancelled the order', async () => {
    const { payments, tx, order } = fixture(); order.status = 'CANCELLED';
    await expect(payments.createPending({ orderId: 'order', provider: 'MPESA', amount: 100, method: 'stk_push' })).rejects.toThrow('not awaiting payment');
    expect(tx.payment.create).not.toHaveBeenCalled();
  });
  it('reuses the pending payment under the order lock', async () => {
    const { payments, tx } = fixture(); tx.payment.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'existing' });
    expect(await payments.createPending({ orderId: 'order', provider: 'MPESA', amount: 100, method: 'stk_push' })).toEqual({ id: 'existing' });
    expect(tx.payment.create).not.toHaveBeenCalled();
  });
});
