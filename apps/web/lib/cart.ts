import { auth } from '@/auth';
import { ensureCartSessionId, getCartSessionId } from '@/lib/cart-session';
import { createRepositories, type CartWithItems } from '@repo/database';

export function sumCartItems(cart: CartWithItems | null): number {
  if (!cart) {
    return 0;
  }
  return cart.items.reduce((total, item) => total + item.quantity, 0);
}

export function calculateCartSubtotal(cart: CartWithItems): number {
  return cart.items.reduce((total, item) => {
    const price =
      typeof item.variant.price === 'object' && 'toNumber' in item.variant.price
        ? item.variant.price.toNumber()
        : Number(item.variant.price);
    return total + price * item.quantity;
  }, 0);
}

/** Resolve the active cart for the current visitor (user or guest) */
export async function resolveCart(): Promise<{
  cart: CartWithItems | null;
  itemCount: number;
}> {
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
}

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
