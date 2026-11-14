import type { Prisma, Review } from '@prisma/client';
import { BaseRepository } from './base.repository';

export interface SubmitReviewInput {
  productId: string;
  userId: string;
  rating: number;
  title?: string | null;
  body?: string | null;
}

export class ReviewRepository extends BaseRepository {
  async findMany(options?: { page?: number; limit?: number }) {
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.min(Math.max(1, options?.limit ?? 50), 200);

    const [items, total] = await Promise.all([
      this.db.review.findMany({
        include: {
          user: { select: { id: true, name: true, email: true } },
          product: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.review.count(),
    ]);

    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  /**
   * Approved, visible reviews for a product page, pinned ones first.
   *
   * Unapproved reviews never reach the storefront — moderation is opt-in
   * rather than opt-out, so nothing publishes until an admin says so.
   */
  async findPublicForProduct(productId: string, limit = 20) {
    return this.db.review.findMany({
      where: { productId, isApproved: true, isHidden: false },
      include: { user: { select: { name: true } } },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
  }

  /** Average rating and count across approved reviews, for badges and JSON-LD. */
  async getRatingSummary(productId: string): Promise<{ average: number | null; count: number }> {
    const result = await this.db.review.aggregate({
      where: { productId, isApproved: true, isHidden: false },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return {
      average: result._avg.rating ?? null,
      count: result._count._all,
    };
  }

  findByProductAndUser(productId: string, userId: string): Promise<Review | null> {
    return this.db.review.findUnique({
      where: { productId_userId: { productId, userId } },
    });
  }

  /**
   * Has this customer actually received this product?
   *
   * Used to stamp `isVerifiedPurchase`. Only delivered orders count — an order
   * that is merely paid may not have arrived yet.
   */
  async hasPurchased(productId: string, userId: string): Promise<boolean> {
    const count = await this.db.order.count({
      where: {
        userId,
        status: 'DELIVERED',
        items: { some: { productId } },
      },
    });
    return count > 0;
  }

  /**
   * Create or replace a customer's review for a product.
   *
   * Always lands unapproved: a re-submitted review goes back through
   * moderation rather than silently republishing with new text.
   */
  async submit(input: SubmitReviewInput & { isVerifiedPurchase: boolean }): Promise<Review> {
    const data = {
      rating: input.rating,
      title: input.title ?? null,
      body: input.body ?? null,
      isVerifiedPurchase: input.isVerifiedPurchase,
      isApproved: false,
    } satisfies Partial<Prisma.ReviewUncheckedCreateInput>;

    return this.db.review.upsert({
      where: { productId_userId: { productId: input.productId, userId: input.userId } },
      create: { productId: input.productId, userId: input.userId, ...data },
      update: data,
    });
  }

  async approve(id: string) {
    return this.db.review.update({ where: { id }, data: { isApproved: true } });
  }

  async reject(id: string) {
    return this.db.review.update({ where: { id }, data: { isApproved: false } });
  }

  async pin(id: string) {
    return this.db.review.update({ where: { id }, data: { isPinned: true } });
  }

  async unpin(id: string) {
    return this.db.review.update({ where: { id }, data: { isPinned: false } });
  }

  async reply(id: string, adminReply: string) {
    return this.db.review.update({ where: { id }, data: { adminReply } });
  }

  async delete(id: string) {
    return this.db.review.delete({ where: { id } });
  }
}