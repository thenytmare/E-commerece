'use server';

import { getOrCreateActiveCart } from '@/lib/cart';
import { createRepositories } from '@repo/database';
import { revalidatePath } from 'next/cache';

export type CartActionState = {
  error?: string;
  success?: boolean;
};

function revalidateCartPaths() {
  revalidatePath('/cart');
  revalidatePath('/', 'layout');
}

export async function addToCartAction(
  _prevState: CartActionState | null,
  formData: FormData
): Promise<CartActionState> {
  const variantId = String(formData.get('variantId') ?? '');
  const quantity = Math.max(1, Number(formData.get('quantity') ?? 1));

  if (!variantId) {
    return { error: 'Please select a product variant' };
  }

  try {
    const cart = await getOrCreateActiveCart();
    const repos = createRepositories();
    await repos.cart.addItem(cart.id, variantId, quantity);
    revalidateCartPaths();
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add to cart';
    return { error: message };
  }
}

export async function updateCartItemAction(
  _prevState: CartActionState | null,
  formData: FormData
): Promise<CartActionState> {
  const cartItemId = String(formData.get('cartItemId') ?? '');
  const quantity = Number(formData.get('quantity') ?? 1);

  if (!cartItemId) {
    return { error: 'Invalid cart item' };
  }

  try {
    const repos = createRepositories();
    await repos.cart.updateItemQuantity(cartItemId, quantity);
    revalidateCartPaths();
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update cart';
    return { error: message };
  }
}

export async function removeCartItemAction(cartItemId: string): Promise<CartActionState> {
  if (!cartItemId) {
    return { error: 'Invalid cart item' };
  }

  try {
    const repos = createRepositories();
    await repos.cart.removeItem(cartItemId);
    revalidateCartPaths();
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove item';
    return { error: message };
  }
}
