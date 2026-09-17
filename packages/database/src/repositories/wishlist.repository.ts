import type { Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';

const wishlistInclude = {
  product: {
    include: {
      brand: { select: { name: true, slug: true } },
      images: {
        take: 1,
        orderBy: [{ isFeatured: 'desc' as const }, { sortOrder: 'asc' as const }],
      },
      variants: {
        where: { isDefault: true },
        take: 1,
        select: { id: true, price: true, compareAtPrice: true },
      },
    },
  },
} satisfies Prisma.WishlistItemInclude;

export type WishlistEntry = Prisma.WishlistItemGetPayload<{ include: typeof wishlistInclude }>;

/**
 * Saved products.
 *
 * The WishlistItem model has existed since the initial schema but had no
 * repository and no UI — nothing in the app could read or write it.
 */
export class WishlistRepository extends BaseRepository {
  /** A user's saved products, newest first. Inactive products are filtered out. */
  listForUser(userId: string): Promise<WishlistEntry[]> {
    return this.db.wishlistItem.findMany({
      where: { userId, product: { isActive: true, deletedAt: null } },
      include: wishlistInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Product ids this user has saved — for rendering the toggle state. */
  async listProductIdsForUser(userId: string): Promise<string[]> {
    const rows = await this.db.wishlistItem.findMany({
      where: { userId },
      select: { productId: true },
    });
    return [...new Set(rows.map((row) => row.productId))];
  }

  countForUser(userId: string): Promise<number> {
    return this.db.wishlistItem.count({ where: { userId } });
  }

  /**
   * Add a product to a wishlist, ignoring a repeat add.
   *
   * `variantId` is part of the unique key, so saving without one is its own
   * distinct entry — that's deliberate: "save this product" and "save this
   * exact variant" are different intents.
   */
  async add(userId: string, productId: string, variantId?: string | null): Promise<void> {
    // find-then-create rather than upsert: `variantId` is nullable, and Prisma
    // won't accept null in a compound unique `where`.
    const existing = await this.db.wishlistItem.findFirst({
      where: { userId, productId, variantId: variantId ?? null },
      select: { id: true },
    });
    if (existing) return;

    await this.db.wishlistItem.create({
      data: { userId, productId, variantId: variantId ?? null },
    });
  }

  /** Remove every saved entry for a product, whichever variant it was saved under. */
  async remove(userId: string, productId: string): Promise<void> {
    await this.db.wishlistItem.deleteMany({ where: { userId, productId } });
  }

  async has(userId: string, productId: string): Promise<boolean> {
    const count = await this.db.wishlistItem.count({ where: { userId, productId } });
    return count > 0;
  }
}
