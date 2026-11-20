import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductRepository } from './product.repository';

function makeDb(existing: { id: string; sku: string; isDefault: boolean; createdAt: Date }[]) {
  const tx = {
    product: { update: vi.fn().mockResolvedValue({}) },
    productVariant: {
      findMany: vi.fn().mockResolvedValue(existing),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    brand: { findUnique: vi.fn().mockResolvedValue({ name: 'Anker' }) },
    orderItem: { count: vi.fn().mockResolvedValue(0) },
    cartItem: { deleteMany: vi.fn() },
    wishlistItem: { deleteMany: vi.fn() },
    productImage: { deleteMany: vi.fn(), create: vi.fn() },
    productFeature: { deleteMany: vi.fn(), createMany: vi.fn() },
    inventory: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    inventoryLog: { create: vi.fn() },
  };
  const db = { $transaction: vi.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) };
  return { db, tx };
}

const base = {
  product: { name: 'Cable' },
  basePrice: 1000,
  compareAtPrice: null,
  hasVariants: true,
  brandId: 'b1',
  name: 'Cable',
};

describe('ProductRepository.updateAggregate', () => {
  it('sets stock with an atomic reservation and stale-value check, and records the change', async () => {
    const { db, tx } = makeDb([{ id: 'v1', sku: 'SKU', isDefault: true, createdAt: new Date() }]);
    await new ProductRepository(db as never).updateAggregate('p1', { ...base, hasVariants: false, stock: 12, expectedStock: 8, actorId: 'admin' });
    expect(tx.inventory.updateMany).toHaveBeenCalledWith({ where: { variantId: 'v1', quantity: 8, reserved: { lte: 12 } }, data: { quantity: 12 } });
    expect(tx.inventoryLog.create).toHaveBeenCalledWith({ data: { variantId: 'v1', change: 4, reason: 'admin_product_edit', referenceId: 'admin' } });
  });

  it('rejects stale quantities or reductions below reserved units without recording a change', async () => {
    const { db, tx } = makeDb([{ id: 'v1', sku: 'SKU', isDefault: true, createdAt: new Date() }]);
    tx.inventory.updateMany.mockResolvedValue({ count: 0 });
    await expect(new ProductRepository(db as never).updateAggregate('p1', { ...base, variants: [{ id: 'v1', name: 'Red', hex: '#f00', stock: 2, expectedStock: 8 }] })).rejects.toThrow('Stock changed');
    expect(tx.inventoryLog.create).not.toHaveBeenCalled();
    expect(tx.productVariant.update).not.toHaveBeenCalled();
  });

  it('leaves stock untouched during an ordinary product edit', async () => {
    const { db, tx } = makeDb([{ id: 'v1', sku: 'SKU', isDefault: true, createdAt: new Date() }]);
    await new ProductRepository(db as never).updateAggregate('p1', { ...base, hasVariants: false });
    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
  });

  it('rejects existing stock edits without a previous quantity', async () => {
    const { db, tx } = makeDb([{ id: 'v1', sku: 'SKU', isDefault: true, createdAt: new Date() }]);
    await expect(new ProductRepository(db as never).updateAggregate('p1', { ...base, hasVariants: false, stock: 4 })).rejects.toThrow('previous quantity');
    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
  });
  beforeEach(() => vi.clearAllMocks());

  it('refuses a variant id that belongs to another product, before touching variants', async () => {
    const { db, tx } = makeDb([{ id: 'mine', sku: 'ANKE-CABL-01', isDefault: true, createdAt: new Date() }]);
    const repo = new ProductRepository(db as never);

    await expect(
      repo.updateAggregate('p1', {
        ...base,
        variants: [{ id: 'someone-elses', name: 'Red', hex: '#f00' }],
      })
    ).rejects.toThrow('does not belong');

    expect(tx.productVariant.update).not.toHaveBeenCalled();
    expect(tx.productVariant.create).not.toHaveBeenCalled();
  });

  it('gives a new variant zero opening stock unless the admin sets it', async () => {
    const { db, tx } = makeDb([{ id: 'v1', sku: 'ANKE-CABL-01', isDefault: true, createdAt: new Date() }]);
    const repo = new ProductRepository(db as never);

    await repo.updateAggregate('p1', {
      ...base,
      variants: [
        { id: 'v1', name: 'Black', hex: '#000' },
        { name: 'Red', hex: '#f00' },
        { name: 'Blue', hex: '#00f', stock: 7 },
      ],
    });

    const creates = tx.productVariant.create.mock.calls.map((c) => c[0].data);
    expect(creates[0].inventory.create.quantity).toBe(0);
    expect(creates[1].inventory.create.quantity).toBe(7);
  });

  it('never reuses an existing SKU for a new variant', async () => {
    const { db, tx } = makeDb([
      { id: 'v1', sku: 'ANKE-CABL-01', isDefault: true, createdAt: new Date() },
      { id: 'v3', sku: 'ANKE-CABL-02', isDefault: false, createdAt: new Date() },
    ]);
    const repo = new ProductRepository(db as never);
    await repo.updateAggregate('p1', {
      ...base,
      variants: [
        { id: 'v1', name: 'A', hex: '#000' },
        { id: 'v3', name: 'B', hex: '#111' },
        { name: 'C', hex: '#222' },
      ],
    });
    // 2 existing, so the next index is 3.
    expect(tx.productVariant.create.mock.calls[0]![0].data.sku).toBe('ANKE-CABL-03');
  });

  it('an injected failure part way rejects the whole transaction', async () => {
    const { db, tx } = makeDb([{ id: 'v1', sku: 'ANKE-CABL-01', isDefault: true, createdAt: new Date() }]);
    tx.productImage.create.mockRejectedValue(new Error('db down'));
    const repo = new ProductRepository(db as never);

    await expect(
      repo.updateAggregate('p1', {
        ...base,
        variants: [{ id: 'v1', name: 'A', hex: '#000' }],
        images: { urls: ['/a.png'], variantIndexes: [null] },
      })
    ).rejects.toThrow('db down');
    // Everything ran inside one $transaction, so Postgres rolls it all back.
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});
