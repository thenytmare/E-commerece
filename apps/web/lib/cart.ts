import { cache } from 'react';
import { auth } from '@/auth';
import { ensureCartSessionId, getCartSessionId } from '@/lib/cart-session';
import { createRepositories, type CartWithItems } from '@repo/database';

export function sumCartItems(cart: CartWithItems | null): number {
  if (!cart) {
    return 0;
  }
  return cart.items.reduce((total, item) => total + item.quantity, 0);
}

/**
 * Unit price per variant for this cart, with any active flash sale applied.
 *
 * Mirrors what OrderRepository charges at checkout, so the cart, the checkout
 * summary, and the final invoice all show the same number. The order
 * repository still resolves prices independently — it is the authority on what
 * is actually charged; this exists so the customer isn't shown something else.
 */
export async function resolveCartUnitPrices(
  cart: CartWithItems
): Promise<Map<string, number>> {
  const repos = createRepositories();
  const productIds = [...new Set(cart.items.map((item) => item.variant.productId))];
  const sales = await repos.flashSale.getActiveForProducts(productIds);

  const unitPrices = new Map<string, number>();
  for (const item of cart.items) {
    const listPrice = Number(item.variant.price);
    const sale = sales.get(item.variant.productId);
    unitPrices.set(
      item.variantId,
      sale ? Math.min(listPrice, Number(sale.salePrice)) : listPrice
    );
  }
  return unitPrices;
}

/**
 * Resolve the active cart for the current visitor (user or guest).
 *
 * The header, the cart page, and the checkout page each call this
 * independently within the same request. `cache()` dedupes them into one
 * DB round trip per request.
 */
export const resolveCart = cache(async (): Promise<{
  cart: CartWithItems | null;
  itemCount: number;
}> => {
  const repos = createRepositories();
  const session = await auth();

  if (session?.user?.id) {
    const cart = await repos.cart.findByUserId(session.user.id);
    return { cart, itemCount: sumCartItems(cart) };
  }

  const sessionId = await getCartSessionId();
  if (!sessionId) {
    return { cart: null, itemCount: 0 };
  }

  const cart = await repos.cart.findBySessionId(sessionId);
  return { cart, itemCount: sumCartItems(cart) };
});

/** Get or create the cart for the current visitor */
export async function getOrCreateActiveCart(): Promise<CartWithItems> {
  const repos = createRepositories();
  const session = await auth();

  if (session?.user?.id) {
    return repos.cart.getOrCreateForUser(session.user.id);
  }

  const sessionId = await ensureCartSessionId();
  return repos.cart.getOrCreateForSession(sessionId);
}

/** Merge guest cart into user cart after authentication */
export async function mergeGuestCartForUser(userId: string): Promise<void> {
  const sessionId = await getCartSessionId();
  if (!sessionId) {
    return;
  }

  const repos = createRepositories();
  await repos.cart.mergeGuestIntoUser(sessionId, userId);

  const { clearCartSessionId } = await import('@/lib/cart-session');
  await clearCartSessionId();
}
