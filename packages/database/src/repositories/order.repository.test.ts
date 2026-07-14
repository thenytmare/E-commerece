import { describe, expect, it, vi } from 'vitest';
import { OrderRepository } from './order.repository';

describe('OrderRepository', () => {
  const mockDb = {
    address: { findFirst: vi.fn() },
    order: { create: vi.fn(), findUniqueOrThrow: vi.fn() },
    inventory: { findUnique: vi.fn(), update: vi.fn() },
    inventoryLog: { create: vi.fn() },
    cartItem: { deleteMany: vi.fn() },
    $transaction: vi.fn((fn: (tx: typeof mockDb) => Promise<unknown>) => fn(mockDb)),
  };

  const repo = new OrderRepository(mockDb as never);

  const emptyCart = {
    id: 'cart-1',
    items: [],
  };

  it('createFromCart throws when cart is empty', async () => {
    await expect(
      repo.createFromCart({
        cart: emptyCart as never,
        userId: 'user-1',
        addressId: 'addr-1',
      })
    ).rejects.toThrow('Cart is empty');
  });

  it('createFromCart throws when address is invalid', async () => {
    mockDb.address.findFirst.mockResolvedValue(null);

    await expect(
      repo.createFromCart({
        cart: {
          id: 'cart-1',
          items: [
            {
              variantId: 'v1',
              quantity: 1,
              variant: {
                productId: 'p1',
                sku: 'SKU-1',
                price: 1000,
                attributes: {},
                product: { name: 'Test Product' },
              },
            },
          ],
        } as never,
        userId: 'user-1',
        addressId: 'addr-1',
      })
    ).rejects.toThrow('Invalid shipping address');
  });
});
