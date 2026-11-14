import { BaseRepository } from './base.repository';
import { enqueueJobs } from './job.repository';

/** Job type for the "it is back in stock" email. Handled in apps/web/lib/jobs. */
export const BACK_IN_STOCK_EMAIL_JOB = 'back-in-stock.email';

export class BackInStockRepository extends BaseRepository {
  /**
   * Register interest in a restock, or reactivate an existing registration.
   *
   * Matching is done against whichever identifier the subscriber actually
   * supplied. The previous version always keyed on email, falling back to the
   * literal string `''` when there wasn't one — but rows are stored with
   * `email: null`, so that lookup could never match. Phone-only subscribers
   * therefore created a fresh row on every submit (filling the admin queue
   * with duplicates), and a signed-in subscriber without an email hit the
   * `productId + userId` unique constraint and saw a spurious "you may already
   * be subscribed" error.
   */
  async subscribe(data: {
    productId: string;
    email?: string;
    phone?: string;
    userId?: string;
  }) {
    const existing = await this.db.backInStockNotification.findFirst({
      where: {
        productId: data.productId,
        ...(data.userId
          ? { userId: data.userId }
          : data.email
            ? { email: data.email }
            : { phone: data.phone }),
      },
    });

    if (existing) {
      return this.db.backInStockNotification.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          // Clear any previous notification so a restock notifies them again.
          notifiedAt: null,
          email: data.email ?? existing.email,
          phone: data.phone ?? existing.phone,
        },
      });
    }

    return this.db.backInStockNotification.create({
      data: {
        productId: data.productId,
        email: data.email ?? null,
        phone: data.phone ?? null,
        userId: data.userId ?? null,
      },
    });
  }

  async getActiveForProduct(productId: string) {
    return this.db.backInStockNotification.findMany({
      where: { productId, isActive: true, notifiedAt: null },
    });
  }

  /** Count of people waiting on a given product — used by the storefront form. */
  countActiveForProduct(productId: string): Promise<number> {
    return this.db.backInStockNotification.count({
      where: { productId, isActive: true, notifiedAt: null },
    });
  }

  /**
   * All outstanding subscriptions with product context, for the admin
   * notification queue. Ordered oldest-first so the longest-waiting
   * customers surface at the top.
   */
  listPendingWithProduct() {
    return this.db.backInStockNotification.findMany({
      where: { isActive: true, notifiedAt: null },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
            variants: { select: { inventory: { select: { quantity: true, reserved: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async markNotified(id: string) {
    return this.db.backInStockNotification.update({
      where: { id },
      data: { notifiedAt: new Date(), isActive: false },
    });
  }

  /**
   * Marks everyone waiting on a product as notified, queues an email for each
   * one we can email, and returns them all so the caller can also reach the
   * rest (phone only) another way.
   *
   * Marking and queueing happen in one transaction (outbox), so a subscriber
   * is never marked "notified" without an email on its way, or the reverse.
   * Each row is claimed with `notifiedAt: null` in the condition, so two
   * restocks at the same moment cannot both notify the same person.
   */
  async notifyProductInStock(productId: string) {
    return this.db.$transaction(async (tx) => {
      // A hidden product cannot be bought, so do not tell people it is back.
      // Their subscriptions stay waiting until the product is shown again.
      const visible = await tx.product.count({
        where: { id: productId, isActive: true, deletedAt: null },
      });
      if (visible === 0) return [];

      const waiting = await tx.backInStockNotification.findMany({
        where: { productId, isActive: true, notifiedAt: null },
      });
      if (waiting.length === 0) return [];

      const notifiedAt = new Date();
      const claimed: typeof waiting = [];
      for (const sub of waiting) {
        const result = await tx.backInStockNotification.updateMany({
          where: { id: sub.id, notifiedAt: null },
          data: { notifiedAt, isActive: false },
        });
        if (result.count === 1) claimed.push(sub);
      }

      await enqueueJobs(
        tx,
        claimed
          .filter((sub) => sub.email || sub.userId)
          .map((sub) => ({
            type: BACK_IN_STOCK_EMAIL_JOB,
            payload: { subscriptionId: sub.id },
            // One email per subscriber per restock. A later restock after
            // they subscribe again gets a new key, because notifiedAt differs.
            uniqueKey: `back-in-stock:${sub.id}:${notifiedAt.toISOString()}`,
          }))
      );

      return claimed;
    });
  }
}
