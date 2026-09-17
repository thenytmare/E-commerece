import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { OrderRepository } from './order.repository';

describe('OrderRepository', () => {
  const mockDb = {
    address: { findFirst: vi.fn() },
    order: {
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    inventory: { findUnique: vi.fn(), update: vi.fn() },
    inventoryLog: { create: vi.fn() },
    cartItem: { deleteMany: vi.fn() },
    payment: { updateMany: vi.fn() },
    orderStatusHistory: { create: vi.fn() },
    coupon: { findFirst: vi.fn(), updateMany: vi.fn() },
    flashSale: { findMany: vi.fn() },
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    $transaction: vi.fn((fn: (tx: typeof mockDb) => Promise<unknown>) => fn(mockDb)),
  };

  const repo = new OrderRepository(mockDb as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const emptyCart = {
    id: 'cart-1',
    items: [],
  };

  /**
   * A single-item cart, and the plumbing `createFromCart` needs for it: a
   * valid shipping address, no active flash sale, a successful atomic stock
   * reservation, and enough to build the returned OrderDetail. Individual
   * tests below override whichever piece of this they mean to exercise.
   */
  function stubHappyPath() {
    mockDb.address.findFirst.mockResolvedValue({ id: 'addr-1', userId: 'user-1' });
    mockDb.flashSale.findMany.mockResolvedValue([]);
    mockDb.$executeRaw.mockResolvedValue(1);
    mockDb.$queryRaw.mockResolvedValue([{}]);
    mockDb.inventoryLog.create.mockResolvedValue({});
    mockDb.cartItem.deleteMany.mockResolvedValue({ count: 1 });
    mockDb.order.create.mockResolvedValue({ id: 'order-1' });
    mockDb.order.findUniqueOrThrow.mockResolvedValue({ id: 'order-1', orderNumber: 'TV-1' });
  }

  function makeCart(overrides?: { quantity?: number; price?: number }) {
    return {
      id: 'cart-1',
      items: [
        {
          variantId: 'v1',
          quantity: overrides?.quantity ?? 1,
          variant: {
            productId: 'p1',
            sku: 'SKU-1',
            price: overrides?.price ?? 1000,
            attributes: {},
            product: { name: 'Test Product' },
          },
        },
      ],
    };
  }

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

  it('findById fetches order with details', async () => {
    mockDb.order.findUnique.mockResolvedValue({ id: 'order-1', orderNumber: 'TV-1' });
    const order = await repo.findById('order-1');
    expect(mockDb.order.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'order-1' } })
    );
    expect(order?.id).toBe('order-1');
  });

  it('cancelOrder decrements reserved stock and cancels order', async () => {
    mockDb.order.findUniqueOrThrow.mockResolvedValue({
      id: 'order-1',
      status: 'PENDING',
      items: [{ variantId: 'v1', quantity: 2 }],
    });
    mockDb.inventory.update.mockResolvedValue({});
    mockDb.payment.updateMany.mockResolvedValue({ count: 0 });
    mockDb.order.update.mockResolvedValue({});
    mockDb.orderStatusHistory.create.mockResolvedValue({});

    await repo.cancelOrder('order-1');

    expect(mockDb.inventory.update).toHaveBeenCalledWith({
      where: { variantId: 'v1' },
      data: { reserved: { decrement: 2 } },
    });
    expect(mockDb.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: 'CANCELLED' },
    });
  });

  // --- createFromCart: atomic stock reservation & coupon redemption -------
  //
  // This harness mocks the Prisma client rather than running against a real
  // Postgres instance, so it can't put two transactions on the wire at the
  // same time and observe a genuine race. What it can and does check is the
  // guard each atomic operation depends on: that a zero-affected-rows result
  // from the conditional `UPDATE`/`updateMany` is treated as "lost the
  // race" and rejected cleanly, exercised here as a first call that
  // succeeds followed by a second, sequential call the mock is set up to
  // report as having found no remaining allowance — the same outcome two
  // truly concurrent callers would produce for whichever one committed
  // second.

  it('createFromCart reserves stock and creates an order on the happy path', async () => {
    stubHappyPath();

    const order = await repo.createFromCart({
      cart: makeCart({ quantity: 2, price: 1000 }) as never,
      userId: 'user-1',
      addressId: 'addr-1',
    });

    expect(order).toEqual({ id: 'order-1', orderNumber: 'TV-1' });

    // The reservation is one atomic UPDATE ... WHERE quantity - reserved >=
    // qty, not a read followed by a separate write.
    expect(mockDb.$executeRaw).toHaveBeenCalledTimes(1);

    const createArgs = mockDb.order.create.mock.calls[0]![0];
    expect(createArgs.data.subtotal.toString()).toBe('2000');
    expect(createArgs.data.discount.toString()).toBe('0');
    // Below the free-shipping threshold, so the flat rate applies.
    expect(createArgs.data.shipping.toString()).toBe('500');
    expect(createArgs.data.tax.toString()).toBe('0');
    expect(createArgs.data.total.toString()).toBe('2500');
    expect(mockDb.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: 'cart-1' } });
  });

  it('createFromCart rejects cleanly when the atomic reservation finds no stock left', async () => {
    stubHappyPath();
    // Zero rows updated: the WHERE clause's availability check failed —
    // exactly what a second, losing concurrent reservation for the last
    // unit would also see.
    mockDb.$executeRaw.mockResolvedValue(0);

    await expect(
      repo.createFromCart({
        cart: makeCart({ quantity: 1 }) as never,
        userId: 'user-1',
        addressId: 'addr-1',
      })
    ).rejects.toThrow('Insufficient stock for Test Product');

    expect(mockDb.order.create).not.toHaveBeenCalled();
  });

  it('createFromCart: a second reservation for the same last unit fails after the first succeeds', async () => {
    stubHappyPath();
    // First call reserves the only unit (1 row updated); a second,
    // sequential call finds none left (0 rows updated) — the same
    // pass/fail split two genuinely concurrent transactions would produce,
    // since only one of them can win the atomic UPDATE.
    mockDb.$executeRaw.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    const cart = makeCart({ quantity: 1 }) as never;
    await expect(
      repo.createFromCart({ cart, userId: 'user-1', addressId: 'addr-1' })
    ).resolves.toMatchObject({ id: 'order-1' });

    await expect(
      repo.createFromCart({ cart, userId: 'user-1', addressId: 'addr-1' })
    ).rejects.toThrow('Insufficient stock for Test Product');
  });

  it('createFromCart applies a percentage coupon and increments its usage atomically', async () => {
    stubHappyPath();
    mockDb.coupon.findFirst.mockResolvedValue({
      id: 'coupon-1',
      type: 'PERCENTAGE',
      value: new Prisma.Decimal(10),
      minOrder: null,
      maxUses: 5,
      maxUsesPerCustomer: null,
      usedCount: 0,
    });
    mockDb.coupon.updateMany.mockResolvedValue({ count: 1 });

    await repo.createFromCart({
      cart: makeCart({ quantity: 1, price: 1000 }) as never,
      userId: 'user-1',
      addressId: 'addr-1',
      couponCode: 'SAVE10',
    });

    expect(mockDb.coupon.updateMany).toHaveBeenCalledWith({
      where: { id: 'coupon-1', OR: [{ maxUses: null }, { usedCount: { lt: 5 } }] },
      data: { usedCount: { increment: 1 } },
    });

    const createArgs = mockDb.order.create.mock.calls[0]![0];
    expect(createArgs.data.couponId).toBe('coupon-1');
    // 10% of a 1000 subtotal.
    expect(createArgs.data.discount.toString()).toBe('100');
    expect(createArgs.data.total.toString()).toBe('1400'); // 1000 + 500 shipping - 100 discount
  });

  it('createFromCart rejects an unknown or expired coupon code', async () => {
    stubHappyPath();
    mockDb.coupon.findFirst.mockResolvedValue(null);

    await expect(
      repo.createFromCart({
        cart: makeCart() as never,
        userId: 'user-1',
        addressId: 'addr-1',
        couponCode: 'NOPE',
      })
    ).rejects.toThrow('This coupon code is invalid or has expired');

    expect(mockDb.order.create).not.toHaveBeenCalled();
  });

  it('createFromCart rejects a coupon whose global usage cap the initial check missed', async () => {
    stubHappyPath();
    // usedCount (0) is under maxUses (1), so the up-front check passes —
    // this simulates a concurrent checkout consuming the last redemption
    // between that read and this one reaching the atomic increment below.
    mockDb.coupon.findFirst.mockResolvedValue({
      id: 'coupon-1',
      type: 'FIXED',
      value: new Prisma.Decimal(200),
      minOrder: null,
      maxUses: 1,
      maxUsesPerCustomer: null,
      usedCount: 0,
    });
    // The conditional updateMany re-checks usedCount < maxUses itself and
    // finds it no longer holds, so it updates zero rows.
    mockDb.coupon.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repo.createFromCart({
        cart: makeCart() as never,
        userId: 'user-1',
        addressId: 'addr-1',
        couponCode: 'ONETIME',
      })
    ).rejects.toThrow('This coupon has reached its usage limit');

    expect(mockDb.order.create).not.toHaveBeenCalled();
  });

  it('createFromCart: a second redemption of a maxUses=1 coupon fails after the first succeeds', async () => {
    stubHappyPath();
    // Same up-front read (usedCount 0 < maxUses 1) both times — only the
    // atomic updateMany distinguishes the winner from the loser, exactly as
    // two genuinely concurrent checkouts racing for the same last
    // redemption would see.
    mockDb.coupon.findFirst.mockResolvedValue({
      id: 'coupon-1',
      type: 'FIXED',
      value: new Prisma.Decimal(200),
      minOrder: null,
      maxUses: 1,
      maxUsesPerCustomer: null,
      usedCount: 0,
    });
    mockDb.coupon.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    const cart = makeCart() as never;
    await expect(
      repo.createFromCart({
        cart,
        userId: 'user-1',
        addressId: 'addr-1',
        couponCode: 'ONETIME',
      })
    ).resolves.toMatchObject({ id: 'order-1' });

    await expect(
      repo.createFromCart({
        cart,
        userId: 'user-2',
        addressId: 'addr-1',
        couponCode: 'ONETIME',
      })
    ).rejects.toThrow('This coupon has reached its usage limit');
  });

  it('createFromCart rejects a coupon that has already hit this customer\'s per-account cap', async () => {
    stubHappyPath();
    mockDb.coupon.findFirst.mockResolvedValue({
      id: 'coupon-1',
      type: 'FIXED',
      value: new Prisma.Decimal(200),
      minOrder: null,
      maxUses: null,
      maxUsesPerCustomer: 1,
      usedCount: 0,
    });
    mockDb.order.count.mockResolvedValue(1);

    await expect(
      repo.createFromCart({
        cart: makeCart() as never,
        userId: 'user-1',
        addressId: 'addr-1',
        couponCode: 'ONEPERCUSTOMER',
      })
    ).rejects.toThrow('You have already used this coupon the maximum number of times');

    // The per-customer count is only trustworthy because the advisory lock
    // serializing this (coupon, customer) pair was taken first.
    expect(mockDb.$queryRaw).toHaveBeenCalledTimes(1);
    const lockArgs = mockDb.$queryRaw.mock.calls[0]!;
    expect(lockArgs.slice(1)).toEqual(['coupon-1', 'user-1']);
    expect(mockDb.order.count).toHaveBeenCalledWith({
      where: { couponId: 'coupon-1', userId: 'user-1', status: { notIn: ['CANCELLED'] } },
    });
    expect(mockDb.order.create).not.toHaveBeenCalled();
  });

  it('createFromCart does not lock or count per-customer usage for a guest checkout', async () => {
    stubHappyPath();
    mockDb.coupon.findFirst.mockResolvedValue({
      id: 'coupon-1',
      type: 'FIXED',
      value: new Prisma.Decimal(200),
      minOrder: null,
      maxUses: null,
      maxUsesPerCustomer: 1,
      usedCount: 0,
    });
    mockDb.coupon.updateMany.mockResolvedValue({ count: 1 });
    mockDb.address.findFirst.mockResolvedValue({ id: 'addr-1', userId: null });

    await repo.createFromCart({
      cart: makeCart() as never,
      userId: null,
      addressId: 'addr-1',
      guestEmail: 'guest@example.com',
      couponCode: 'ONEPERCUSTOMER',
    });

    // No account to cap, so the per-customer lock/count never runs — only
    // the global maxUses cap (there is none configured here) can apply.
    expect(mockDb.$queryRaw).not.toHaveBeenCalled();
    expect(mockDb.order.count).not.toHaveBeenCalled();
  });
});
