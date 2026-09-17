import { auth } from '@/auth';
import { createRepositories } from '@repo/database';
import type { OrderDetail } from '@repo/database';
import { canAccessGuestOrder } from '@/lib/guest-orders';

/**
 * Load an order the current visitor is entitled to see.
 *
 * Two ways to qualify: the order belongs to the signed-in account, or this
 * browser holds a signed cookie proving it placed the order as a guest.
 * Returns null otherwise, so callers can 404 rather than leak whether an order
 * number exists.
 */
export async function loadViewableOrder(orderNumber: string): Promise<OrderDetail | null> {
  const repos = createRepositories();
  const session = await auth();

  if (session?.user?.id) {
    const owned = await repos.order.findByOrderNumberForUser(orderNumber, session.user.id);
    if (owned) return owned;
  }

  if (await canAccessGuestOrder(orderNumber)) {
    const order = await repos.order.findByOrderNumber(orderNumber);
    // Only genuinely ownerless orders are reachable this way — a cookie must
    // never open an order that belongs to somebody's account.
    if (order && order.userId === null) return order;
  }

  return null;
}
