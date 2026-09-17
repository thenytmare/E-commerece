import type { FlashSale } from '@prisma/client';
import { BaseRepository } from './base.repository';

export class FlashSaleRepository extends BaseRepository {
  async findMany(options?: { page?: number; limit?: number }) {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const [items, total] = await Promise.all([
      this.db.flashSale.findMany({
        include: { product: { select: { name: true, slug: true, basePrice: true } } },
        orderBy: { startsAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.flashSale.count(),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async create(data: { productId: string; salePrice: number; startsAt: Date; endsAt: Date }): Promise<FlashSale> {
    return this.db.flashSale.create({ data });
  }

  /**
   * Any sale on this product whose window overlaps the given range.
   *
   * Overlapping sales aren't rejected by the database, and the storefront
   * silently resolves a clash by showing the cheapest — so an admin who
   * created a replacement sale would see the old, cheaper one keep winning
   * with no indication why.
   */
  findOverlapping(
    productId: string,
    startsAt: Date,
    endsAt: Date,
    excludeId?: string
  ): Promise<FlashSale[]> {
    return this.db.flashSale.findMany({
      where: {
        productId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        // Two ranges overlap when each starts before the other ends.
        startsAt: { lte: endsAt },
        endsAt: { gte: startsAt },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  async delete(id: string): Promise<FlashSale> {
    return this.db.flashSale.delete({ where: { id } });
  }

  async getActive(): Promise<FlashSale[]> {
    const now = new Date();
    return this.db.flashSale.findMany({
      where: { startsAt: { lte: now }, endsAt: { gte: now } },
      include: { product: { select: { name: true, slug: true, basePrice: true } } },
    });
  }

  /** The currently-running sale for one product, if any. */
  async getActiveForProduct(productId: string): Promise<FlashSale | null> {
    const now = new Date();
    return this.db.flashSale.findFirst({
      where: { productId, startsAt: { lte: now }, endsAt: { gte: now } },
      orderBy: { salePrice: 'asc' },
    });
  }

  /** Active sales for a set of products, keyed by productId — for list views. */
  async getActiveForProducts(productIds: string[]): Promise<Map<string, FlashSale>> {
    if (productIds.length === 0) return new Map();
    const now = new Date();
    const sales = await this.db.flashSale.findMany({
      where: { productId: { in: productIds }, startsAt: { lte: now }, endsAt: { gte: now } },
      orderBy: { salePrice: 'asc' },
    });
    const map = new Map<string, FlashSale>();
    for (const sale of sales) {
      if (!map.has(sale.productId)) map.set(sale.productId, sale);
    }
    return map;
  }
}