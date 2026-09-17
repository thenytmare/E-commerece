import { BaseRepository } from './base.repository';

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
   * Marks everyone waiting on a product as notified and returns their
   * contact details so the caller can actually reach them.
   *
   * Delivery itself is deliberately not done here: this project has no
   * transactional email provider configured, and WhatsApp sending is
   * link-based (see admin-whatsapp.ts). The admin queue at
   * /admin/marketing/back-in-stock consumes these records and opens a
   * pre-filled message per subscriber, matching how campaigns already work.
   */
  async notifyProductInStock(productId: string) {
    const subscribers = await this.getActiveForProduct(productId);
    for (const sub of subscribers) {
      await this.markNotified(sub.id);
    }
    return subscribers;
  }
}