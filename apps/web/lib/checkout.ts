import { FLAT_SHIPPING_KES, FREE_SHIPPING_THRESHOLD_KES } from '@repo/config';
import { resolveCartUnitPrices } from '@/lib/cart';
import type { CartWithItems } from '@repo/database';

export function calculateShipping(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_THRESHOLD_KES ? 0 : FLAT_SHIPPING_KES;
}

/**
 * Cart totals as the customer should see them.
 *
 * Async because unit prices depend on which flash sales are running right now
 * — the totals shown must match what checkout will actually charge.
 */
export async function calculateOrderTotals(cart: CartWithItems) {
  const unitPrices = await resolveCartUnitPrices(cart);
  const subtotal = cart.items.reduce(
    (total, item) => total + unitPrices.get(item.variantId)! * item.quantity,
    0
  );
  const shipping = calculateShipping(subtotal);
  const total = subtotal + shipping;
  return { subtotal, shipping, total, unitPrices };
}

export { FLAT_SHIPPING_KES, FREE_SHIPPING_THRESHOLD_KES };
