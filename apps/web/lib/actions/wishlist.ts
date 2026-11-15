'use server';

import { createRepositories, GUEST_WISHLIST_LIMIT } from '@repo/database';
import { revalidatePath } from 'next/cache';
import { getWishlistOwner } from '@/lib/wishlist-owner';

const repos = createRepositories();

export type WishlistActionState = {
  success?: boolean;
  saved?: boolean;
  error?: string;
  requiresSignIn?: boolean;
};

/**
 * Add or remove a product from the shopper's saved items.
 *
 * Works without signing in: a guest's items are kept on this browser and move
 * to their account when they sign in. A guest who reaches the limit is asked
 * to sign in.
 */
export async function toggleWishlistAction(
  productId: string,
  variantId?: string | null
): Promise<WishlistActionState> {
  if (!productId) {
    return { success: false, error: 'No product specified.' };
  }

  try {
    const owner = await getWishlistOwner({ create: true });
    if (!owner) return { success: false, error: 'Could not update your saved items.' };

    const alreadySaved = await repos.wishlist.has(owner, productId);
    if (alreadySaved) {
      await repos.wishlist.remove(owner, productId);
    } else {
      if (owner.sessionId && (await repos.wishlist.countForOwner(owner)) >= GUEST_WISHLIST_LIMIT) {
        return {
          success: false,
          requiresSignIn: true,
          error: `You can save up to ${GUEST_WISHLIST_LIMIT} items without an account. Sign in to save more.`,
        };
      }
      await repos.wishlist.add(owner, productId, variantId);
    }
    revalidatePath('/saved');
    return { success: true, saved: !alreadySaved };
  } catch (error) {
    console.error('Wishlist toggle failed:', error);
    return { success: false, error: 'Could not update your saved items.' };
  }
}
