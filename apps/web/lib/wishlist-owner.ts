import { auth } from '@/auth';
import type { WishlistOwner } from '@repo/database';
import { ensureCartSessionId, getCartSessionId } from '@/lib/cart-session';

/**
 * Who the saved items belong to on this request: the signed-in customer, or
 * else the guest browser. Guests use the same cookie as the guest cart, so
 * both move to the account together at sign-in.
 *
 * With `create`, a guest without the cookie gets one (only when they tap the
 * heart). Without it, a guest with no cookie has nothing saved, so this
 * returns null.
 */
export async function getWishlistOwner(options: { create?: boolean } = {}): Promise<WishlistOwner | null> {
  const session = await auth();
  if (session?.user?.id) return { userId: session.user.id };
  const sessionId = options.create ? await ensureCartSessionId() : await getCartSessionId();
  return sessionId ? { sessionId } : null;
}
