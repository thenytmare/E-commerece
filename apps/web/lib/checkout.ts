import { FREE_SHIPPING_THRESHOLD_KES } from '@repo/config';
import { resolveCartUnitPrices } from '@/lib/cart';
import type { CartWithItems } from '@repo/database';

/**
 * Cart totals as the customer should see them.
 *
 * Async because unit prices depend on which flash sales are running right now
 * — the totals shown must match what checkout will actually charge.
 *
 * Delivery is not included: it depends on the delivery option and location
 * the customer picks at checkout (see @repo/config delivery.ts).
 */
export async function calculateOrderTotals(cart: CartWithItems) {
  const unitPrices = await resolveCartUnitPrices(cart);
  const subtotal = cart.items.reduce(
    (total, item) => total + unitPrices.get(item.variantId)! * item.quantity,
    0
  );
  return { subtotal, unitPrices };
}

export { FREE_SHIPPING_THRESHOLD_KES };
