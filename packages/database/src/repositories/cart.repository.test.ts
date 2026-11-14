import { describe, expect, it, vi } from 'vitest';
import { CartRepository } from './cart.repository';

describe('CartRepository', () => {
  const mockDb = {
    cart: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    cartItem: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      aggregate: vi.fn(),
    },
    inventory: {
      findUnique: vi.fn(),
    },
    productVariant: { findFirst: vi.fn() },
    $transaction: vi.fn((fn: (tx: typeof mockDb) => Promise<unknown>) => fn(mockDb)),
  };

  const repo = new CartRepository(mockDb as never);

  it('countItems returns sum of line quantities', async () => {
    mockDb.cartItem.aggregate.mockResolvedValue({ _sum: { quantity: 5 } });

    const count = await repo.countItems('cart-1');

    expect(count).toBe(5);
  });

  it('addItem refuses a hidden or deleted product', async () => {
    mockDb.productVariant.findFirst.mockResolvedValue(null);
    await expect(repo.addItem('cart-1', 'variant-1', 1)).rejects.toThrow('no longer available');
    expect(mockDb.cartItem.create).not.toHaveBeenCalled();
  });

  it('addItem only accepts variants of active, non-deleted products', async () => {
    mockDb.productVariant.findFirst.mockResolvedValue(null);
    await repo.addItem('cart-1', 'variant-1', 1).catch(() => undefined);
    expect(mockDb.productVariant.findFirst).toHaveBeenCalledWith({
      where: { id: 'variant-1', product: { isActive: true, deletedAt: null } },
      select: { id: true },
    });
  });

  it('addItem throws when stock is insufficient', async () => {
    mockDb.productVariant.findFirst.mockResolvedValue({ id: 'variant-1' });
    mockDb.inventory.findUnique.mockResolvedValue({
      variantId: 'variant-1',
      quantity: 2,
      reserved: 0,
    });
    mockDb.cartItem.findUnique.mockResolvedValue(null);

    await expect(repo.addItem('cart-1', 'variant-1', 3)).rejects.toThrow('Insufficient stock');
  });

  it('mergeGuestIntoUser returns user cart when guest cart is empty', async () => {
    const userCart = { id: 'user-cart', items: [] };
    mockDb.cart.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(userCart);
    mockDb.cart.create.mockResolvedValue(userCart);

    const result = await repo.mergeGuestIntoUser('session-1', 'user-1');

    expect(result).toEqual(userCart);
  });
});
