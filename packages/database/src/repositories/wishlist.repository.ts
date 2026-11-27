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
 * Whose saved items: a signed-in customer, or a guest browser (the guest cart
 * cookie). Exactly one of the two is set.
 */
export type WishlistOwner = { userId: string; sessionId?: never } | { sessionId: string; userId?: never };

/** A guest can save this many products before being asked to sign in. */
export const GUEST_WISHLIST_LIMIT = 100;

export type MostSavedRow = {
  productId: string;
  name: string;
  slug: string;
  /** Every save, by customers and guests. */
  saves: number;
  /** Saves by signed-in customers only. */
  customerSaves: number;
};

function ownerWhere(owner: WishlistOwner): Prisma.WishlistItemWhereInput {
  return owner.userId ? { userId: owner.userId } : { sessionId: owner.sessionId, userId: null };
}

/**
 * Saved products.
 *
 * Signed-in customers keep them on their account. Guests keep them against
 * the guest cart cookie, and they move to the account when the guest signs in.
 */
export class WishlistRepository extends BaseRepository {
  /** Saved products, newest first. Hidden or deleted products are left out. */
  listForOwner(owner: WishlistOwner): Promise<WishlistEntry[]> {
    return this.db.wishlistItem.findMany({
      where: { ...ownerWhere(owner), product: { isActive: true, deletedAt: null } },
      include: wishlistInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  listForUser(userId: string): Promise<WishlistEntry[]> {
    return this.listForOwner({ userId });
  }

  /** Product ids this owner has saved, for showing the heart filled in. */
  async listProductIdsForOwner(owner: WishlistOwner): Promise<string[]> {
    const rows = await this.db.wishlistItem.findMany({
      where: ownerWhere(owner),
      select: { productId: true },
    });
    return [...new Set(rows.map((row) => row.productId))];
  }

  listProductIdsForUser(userId: string): Promise<string[]> {
    return this.listProductIdsForOwner({ userId });
  }

  countForOwner(owner: WishlistOwner): Promise<number> {
    return this.db.wishlistItem.count({ where: ownerWhere(owner) });
  }

  countForUser(userId: string): Promise<number> {
    return this.countForOwner({ userId });
  }

  /**
   * Add a product, ignoring a repeat add.
   *
   * `variantId` is part of the unique key, so saving without one is its own
   * distinct entry: "save this product" and "save this exact variant" are
   * different intents.
   */
  async add(owner: WishlistOwner | string, productId: string, variantId?: string | null): Promise<void> {
    const who: WishlistOwner = typeof owner === 'string' ? { userId: owner } : owner;
    // Hidden or deleted products cannot be saved.
    const visible = await this.db.product.count({
      where: { id: productId, isActive: true, deletedAt: null },
    });
    if (visible === 0) {
      throw new Error('This product is no longer available');
    }

    // find-then-create rather than upsert: `variantId` is nullable, and Prisma
    // won't accept null in a compound unique `where`.
    const existing = await this.db.wishlistItem.findFirst({
      where: { ...ownerWhere(who), productId, variantId: variantId ?? null },
      select: { id: true },
    });
    if (existing) return;

    await this.db.wishlistItem.create({
      data: who.userId
        ? { userId: who.userId, productId, variantId: variantId ?? null }
        : { sessionId: who.sessionId, productId, variantId: variantId ?? null },
    });
  }

  /** Remove every saved entry for a product, whichever variant it was saved under. */
  async remove(owner: WishlistOwner | string, productId: string): Promise<void> {
    const who: WishlistOwner = typeof owner === 'string' ? { userId: owner } : owner;
    await this.db.wishlistItem.deleteMany({ where: { ...ownerWhere(who), productId } });
  }

  async has(owner: WishlistOwner | string, productId: string): Promise<boolean> {
    const who: WishlistOwner = typeof owner === 'string' ? { userId: owner } : owner;
    const count = await this.db.wishlistItem.count({ where: { ...ownerWhere(who), productId } });
    return count > 0;
  }

  /**
   * At sign-in, move a guest's saved items to the account. A product the
   * account has already saved is not added twice. Returns how many moved.
   */
  async mergeGuestIntoUser(sessionId: string, userId: string): Promise<number> {
    return this.db.$transaction(async (tx) => {
      const guestRows = await tx.wishlistItem.findMany({
        where: { sessionId, userId: null },
        select: { id: true, productId: true },
      });
      if (guestRows.length === 0) return 0;

      const already = await tx.wishlistItem.findMany({
        where: { userId, productId: { in: guestRows.map((row) => row.productId) } },
        select: { productId: true },
      });
      const owned = new Set(already.map((row) => row.productId));
      const seen = new Set<string>();
      const move: string[] = [];
      const drop: string[] = [];
      for (const row of guestRows) {
        if (owned.has(row.productId) || seen.has(row.productId)) drop.push(row.id);
        else {
          move.push(row.id);
          seen.add(row.productId);
        }
      }
      if (drop.length) await tx.wishlistItem.deleteMany({ where: { id: { in: drop } } });
      if (move.length) {
        await tx.wishlistItem.updateMany({ where: { id: { in: move } }, data: { userId, sessionId: null } });
      }
      return move.length;
    });
  }

  /**
   * The products saved most often, for the admin dashboard. Counts every
   * save, by customers and by guests. Hidden and deleted products are left out.
   */
  async mostSaved(limit = 8): Promise<MostSavedRow[]> {
    const visible = { product: { isActive: true, deletedAt: null } } satisfies Prisma.WishlistItemWhereInput;
    const totals = await this.db.wishlistItem.groupBy({
      by: ['productId'],
      where: visible,
      _count: { _all: true },
      orderBy: [{ _count: { productId: 'desc' } }, { productId: 'asc' }],
      take: limit,
    });
    if (totals.length === 0) return [];
    const ids = totals.map((row) => row.productId);
    const [products, customer] = await Promise.all([
      this.db.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, slug: true } }),
      this.db.wishlistItem.groupBy({
        by: ['productId'],
        where: { productId: { in: ids }, userId: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const byId = new Map(products.map((product) => [product.id, product]));
    const customerCount = new Map(customer.map((row) => [row.productId, row._count._all]));
    return totals.flatMap((row) => {
      const product = byId.get(row.productId);
      return product
        ? [
            {
              productId: product.id,
              name: product.name,
              slug: product.slug,
              saves: row._count._all,
              customerSaves: customerCount.get(product.id) ?? 0,
            },
          ]
        : [];
    });
  }
}
