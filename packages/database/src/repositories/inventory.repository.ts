import type { Inventory, Prisma } from '@prisma/client';
import { DEFAULT_LOW_STOCK_THRESHOLD } from '@repo/config';
import { BaseRepository } from './base.repository';

export interface StockCheckResult {
  available: boolean;
  quantity: number;
  reserved: number;
  availableQuantity: number;
}

const lowStockInclude = {
  variant: {
    include: {
      product: true,
    },
  },
} satisfies Prisma.InventoryInclude;

export type LowStockInventory = Prisma.InventoryGetPayload<{ include: typeof lowStockInclude }>;

/**
 * Data access for stock levels and inventory adjustments.
 */
export class InventoryRepository extends BaseRepository {
  /** Get inventory record for a product variant */
  findByVariantId(variantId: string): Promise<Inventory | null> {
    return this.db.inventory.findUnique({ where: { variantId } });
  }

  /** Check if requested quantity is available (quantity - reserved) */
  async checkAvailability(variantId: string, requested: number): Promise<StockCheckResult> {
    const inventory = await this.findByVariantId(variantId);

    if (!inventory) {
      return { available: false, quantity: 0, reserved: 0, availableQuantity: 0 };
    }

    const availableQuantity = inventory.quantity - inventory.reserved;

    return {
      available: availableQuantity >= requested,
      quantity: inventory.quantity,
      reserved: inventory.reserved,
      availableQuantity,
    };
  }

  /** Adjust stock level and write an audit log entry */
  async adjustStock(
    variantId: string,
    change: number,
    reason: string,
    referenceId?: string
  ): Promise<Inventory> {
    return this.db.$transaction(async (tx) => {
      const inventory = await tx.inventory.update({
        where: { variantId },
        data: { quantity: { increment: change } },
      });

      await tx.inventoryLog.create({
        data: { variantId, change, reason, referenceId },
      });

      return inventory;
    });
  }

  /** Reserve stock for a pending order */
  async reserveStock(variantId: string, quantity: number): Promise<Inventory> {
    const check = await this.checkAvailability(variantId, quantity);
    if (!check.available) {
      throw new Error(`Insufficient stock for variant ${variantId}`);
    }

    return this.db.inventory.update({
      where: { variantId },
      data: { reserved: { increment: quantity } },
    });
  }

  /** Initialize inventory for a new variant */
  createForVariant(
    variantId: string,
    quantity: number,
    lowStockThreshold = DEFAULT_LOW_STOCK_THRESHOLD
  ): Promise<Inventory> {
    return this.db.inventory.create({
      data: { variantId, quantity, lowStockThreshold },
    });
  }

  /** List variants at or below their low-stock threshold */
  async findLowStock(): Promise<Inventory[]> {
    const records = await this.db.inventory.findMany({
      orderBy: { quantity: 'asc' },
    });

    return records.filter((inv) => inv.quantity - inv.reserved <= inv.lowStockThreshold);
  }

  /** List low-stock variants with product details for admin dashboards */
  async findLowStockDetailed(): Promise<LowStockInventory[]> {
    const records = await this.db.inventory.findMany({
      include: lowStockInclude,
      orderBy: { quantity: 'asc' },
    });

    return records.filter((inv) => inv.quantity - inv.reserved <= inv.lowStockThreshold);
  }
}
