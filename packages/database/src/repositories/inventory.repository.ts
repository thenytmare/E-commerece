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
 * Cap on how many low-stock rows a single call returns.
 *
 * `findLowStock`/`findLowStockDetailed` used to fetch and join the *entire*
 * inventory table (every variant, regardless of stock level) and filter down
 * to the low-stock ones in JS. That got re-run on every admin dashboard poll,
 * for every open admin session, against the whole table. The threshold
 * comparison now happens in SQL, so this is just a sane ceiling on the
 * (already-filtered) result set rather than the thing keeping the query fast.
 */
const MAX_LOW_STOCK_RESULTS = 100;

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

  /**
   * List variants at or below their low-stock threshold.
   *
   * `quantity - reserved <= lowStockThreshold` compares two columns of the
   * same row, which Prisma's query builder can't express in a `where` — so
   * this pushes the comparison into raw SQL instead of fetching every row
   * and filtering in JS (see `order.repository.ts`'s stock reservation for
   * the same constraint).
   */
  async findLowStock(): Promise<Inventory[]> {
    return this.db.$queryRaw<Inventory[]>`
      SELECT
        "id",
        "variant_id" AS "variantId",
        "quantity",
        "reserved",
        "low_stock_threshold" AS "lowStockThreshold"
      FROM "inventory"
      WHERE "quantity" - "reserved" <= "low_stock_threshold"
      ORDER BY "quantity" ASC
      LIMIT ${MAX_LOW_STOCK_RESULTS}
    `;
  }

  /**
   * List low-stock variants with product details for admin dashboards.
   *
   * The threshold comparison can't be expressed through Prisma's `include`
   * (same column-to-column limitation as `findLowStock`), so this first
   * finds the (bounded) set of matching ids with raw SQL, then fetches just
   * those rows through the normal, type-safe `findMany` + `include` — never
   * joining the whole table just to filter it back down in JS.
   */
  async findLowStockDetailed(): Promise<LowStockInventory[]> {
    const matches = await this.db.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "inventory"
      WHERE "quantity" - "reserved" <= "low_stock_threshold"
      ORDER BY "quantity" ASC
      LIMIT ${MAX_LOW_STOCK_RESULTS}
    `;

    if (matches.length === 0) return [];

    const records = await this.db.inventory.findMany({
      where: { id: { in: matches.map((row) => row.id) } },
      include: lowStockInclude,
    });

    const order = new Map(matches.map((row, index) => [row.id, index]));
    return records.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }
}
