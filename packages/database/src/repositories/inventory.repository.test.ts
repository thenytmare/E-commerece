import type { Inventory } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { InventoryRepository } from './inventory.repository';

describe('InventoryRepository', () => {
  const mockDb = {
    inventory: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    inventoryLog: { create: vi.fn() },
    $transaction: vi.fn((fn: (tx: typeof mockDb) => Promise<unknown>) => fn(mockDb)),
  };

  const repo = new InventoryRepository(mockDb as never);

  it('checkAvailability returns unavailable when no inventory exists', async () => {
    mockDb.inventory.findUnique.mockResolvedValue(null);

    const result = await repo.checkAvailability('variant-1', 1);

    expect(result.available).toBe(false);
    expect(result.availableQuantity).toBe(0);
  });

  it('checkAvailability accounts for reserved stock', async () => {
    mockDb.inventory.findUnique.mockResolvedValue({
      variantId: 'variant-1',
      quantity: 10,
      reserved: 3,
      lowStockThreshold: 5,
    });

    const result = await repo.checkAvailability('variant-1', 8);

    expect(result.available).toBe(false);
    expect(result.availableQuantity).toBe(7);
  });

  it('findLowStock filters by available quantity', async () => {
    mockDb.inventory.findMany.mockResolvedValue([
      { variantId: 'a', quantity: 10, reserved: 0, lowStockThreshold: 5 },
      { variantId: 'b', quantity: 3, reserved: 0, lowStockThreshold: 5 },
      { variantId: 'c', quantity: 2, reserved: 2, lowStockThreshold: 5 },
    ]);

    const result = await repo.findLowStock();

    expect(result).toHaveLength(2);
    expect(result.map((r: Inventory) => r.variantId).sort()).toEqual(['b', 'c']);
  });
});
