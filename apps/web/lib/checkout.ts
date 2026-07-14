import { FLAT_SHIPPING_KES, FREE_SHIPPING_THRESHOLD_KES } from '@repo/config';
import { calculateCartSubtotal } from '@/lib/cart';
import type { CartWithItems } from '@repo/database';

export function calculateShipping(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_THRESHOLD_KES ? 0 : FLAT_SHIPPING_KES;
}

export function calculateOrderTotals(cart: CartWithItems) {
  const subtotal = calculateCartSubtotal(cart);
  const shipping = calculateShipping(subtotal);
  const total = subtotal + shipping;
  return { subtotal, shipping, total };
}

export { FLAT_SHIPPING_KES, FREE_SHIPPING_THRESHOLD_KES };
