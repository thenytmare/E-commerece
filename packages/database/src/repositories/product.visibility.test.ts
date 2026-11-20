import { describe, expect, it, vi } from 'vitest';
import { ProductRepository } from './product.repository';
import { WishlistRepository } from './wishlist.repository';
import { BackInStockRepository } from './back-in-stock.repository';

describe('ProductRepository visibility', () => {
  it('bulkSetActive sets isActive and status together and skips deleted products', async () => {
    const db = { product: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) } };
    const repo = new ProductRepository(db as never);

    expect(await repo.bulkSetActive(['a', 'b'], false)).toBe(2);
    expect(db.product.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] }, deletedAt: null },
      data: { isActive: false, status: 'draft' },
    });

    await repo.bulkSetActive(['a'], true);
    expect(db.product.updateMany).toHaveBeenLastCalledWith({
      where: { id: { in: ['a'] }, deletedAt: null },
      data: { isActive: true, status: 'active' },
    });
  });

  it('bulkSetActive with no ids does not touch the database', async () => {
    const db = { product: { updateMany: vi.fn() } };
    expect(await new ProductRepository(db as never).bulkSetActive([], true)).toBe(0);
    expect(db.product.updateMany).not.toHaveBeenCalled();
  });

  it('setVisibility is false for a missing or trashed product', async () => {
    const db = { product: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } };
    expect(await new ProductRepository(db as never).setVisibility('x', true)).toBe(false);
  });

  it('getVisibilityCounts counts visible and hidden, ignoring deleted products', async () => {
    const count = vi.fn().mockResolvedValueOnce(7).mockResolvedValueOnce(3);
    const repo = new ProductRepository({ product: { count } } as never);
    expect(await repo.getVisibilityCounts({ brandId: 'b1' })).toEqual({ all: 10, visible: 7, hidden: 3 });
    expect(count).toHaveBeenCalledWith({ where: { deletedAt: null, brandId: 'b1', isActive: true } });
    expect(count).toHaveBeenCalledWith({ where: { deletedAt: null, brandId: 'b1', isActive: false } });
  });

  it('getAvailableStockByProduct sums on-hand minus reserved over variants, never below zero', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { quantity: 10, reserved: 2, variant: { productId: 'p1' } },
      { quantity: 5, reserved: 0, variant: { productId: 'p1' } },
      { quantity: 1, reserved: 4, variant: { productId: 'p2' } },
    ]);
    const repo = new ProductRepository({ inventory: { findMany } } as never);
    const stock = await repo.getAvailableStockByProduct(['p1', 'p2', 'p3']);
    expect(stock.get('p1')).toBe(13);
    expect(stock.get('p2')).toBe(0);
    expect(stock.get('p3')).toBe(0);
  });
});

describe('storefront queries only return visible products', () => {
  it('findPublicBySlug requires isActive and not deleted', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    await new ProductRepository({ product: { findFirst } } as never).findPublicBySlug('x');
    expect(findFirst.mock.calls[0]![0].where).toEqual({ slug: 'x', deletedAt: null, isActive: true });
  });

  it('findBestSelling only keeps active, non-deleted products', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = {
      orderItem: { groupBy: vi.fn().mockResolvedValue([{ productId: 'p1', _sum: { quantity: 5 } }]) },
      product: { findMany },
    };
    await new ProductRepository(db as never).findBestSelling(4);
    expect(findMany.mock.calls[0]![0].where).toMatchObject({ deletedAt: null, isActive: true });
  });

  it('findMany keeps deleted products out and passes the active filter through', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = { product: { findMany, count: vi.fn().mockResolvedValue(0) } };
    await new ProductRepository(db as never).findMany({ isActive: true });
    expect(findMany.mock.calls[0]![0].where).toMatchObject({ deletedAt: null, isActive: true });
  });
});

describe('wishlist and back-in-stock ignore hidden products', () => {
  it('wishlist.add refuses a hidden product', async () => {
    const db = { product: { count: vi.fn().mockResolvedValue(0) }, wishlistItem: { create: vi.fn(), findFirst: vi.fn() } };
    await expect(new WishlistRepository(db as never).add('u1', 'p1')).rejects.toThrow('no longer available');
    expect(db.wishlistItem.create).not.toHaveBeenCalled();
  });

  it('notifyProductInStock leaves subscribers waiting when the product is hidden', async () => {
    const db: Record<string, unknown> = {
      product: { count: vi.fn().mockResolvedValue(0) },
      backInStockNotification: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
      job: { createMany: vi.fn() },
    };
    db.$transaction = (fn: (tx: unknown) => unknown) => fn(db);
    const result = await new BackInStockRepository(db as never).notifyProductInStock('p1');
    expect(result).toEqual([]);
    const bis = db.backInStockNotification as { updateMany: ReturnType<typeof vi.fn> };
    expect(bis.updateMany).not.toHaveBeenCalled();
    expect((db.job as { createMany: ReturnType<typeof vi.fn> }).createMany).not.toHaveBeenCalled();
  });

  it('notifyProductInStock marks subscribers and queues one email each, in one transaction', async () => {
    const subs = [
      { id: 's1', email: 'a@example.com', userId: null, phone: null },
      { id: 's2', email: null, userId: 'u2', phone: null },
      { id: 's3', email: null, userId: null, phone: '0700000000' },
      { id: 's4', email: 'd@example.com', userId: null, phone: null },
    ];
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
      // Another restock already claimed s4.
      .mockResolvedValueOnce({ count: 0 });
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const transaction = vi.fn();
    const db: Record<string, unknown> = {
      product: { count: vi.fn().mockResolvedValue(1) },
      backInStockNotification: { findMany: vi.fn().mockResolvedValue(subs), updateMany },
      job: { createMany },
    };
    db.$transaction = (fn: (tx: unknown) => unknown) => {
      transaction();
      return fn(db);
    };

    const result = await new BackInStockRepository(db as never).notifyProductInStock('p1');

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(result.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
    expect(updateMany.mock.calls[0]![0].where).toEqual({ id: 's1', notifiedAt: null });
    const jobs = createMany.mock.calls[0]![0];
    expect(jobs.skipDuplicates).toBe(true);
    // s3 has only a phone number, s4 was claimed elsewhere: no email for them.
    expect(jobs.data.map((j: { payload: { subscriptionId: string } }) => j.payload.subscriptionId)).toEqual(['s1', 's2']);
    expect(jobs.data[0].type).toBe('back-in-stock.email');
    expect(jobs.data[0].uniqueKey).toMatch(/^back-in-stock:s1:/);
  });
});
