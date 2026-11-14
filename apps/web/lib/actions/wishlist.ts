'use server';

import { createRepositories } from '@repo/database';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';

const repos = createRepositories();

export type WishlistActionState = {
  success?: boolean;
  saved?: boolean;
  error?: string;
  requiresSignIn?: boolean;
};

/**
 * Add or remove a product from the signed-in customer's wishlist.
 *
 * Returns `requiresSignIn` rather than redirecting, so the button can prompt
 * in place instead of throwing the shopper off the product page.
 */
export async function toggleWishlistAction(
  productId: string,
  variantId?: string | null
): Promise<WishlistActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, requiresSignIn: true, error: 'Sign in to save products.' };
  }

  if (!productId) {
    return { success: false, error: 'No product specified.' };
  }

  try {
    const alreadySaved = await repos.wishlist.has(session.user.id, productId);

    if (alreadySaved) {
      await repos.wishlist.remove(session.user.id, productId);
    } else {
      await repos.wishlist.add(session.user.id, productId, variantId);
    }

    revalidatePath('/account/wishlist');
    return { success: true, saved: !alreadySaved };
  } catch (error) {
    console.error('Wishlist toggle failed:', error);
    return { success: false, error: 'Could not update your saved items.' };
  }
}
