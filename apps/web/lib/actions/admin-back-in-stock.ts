'use server';

import { createRepositories } from '@repo/database';
import { requirePermission } from './auth';
import { revalidatePath } from 'next/cache';

const repos = createRepositories();

export type BackInStockSubscriber = {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  /** Whether the product currently has sellable stock across its variants. */
  inStock: boolean;
};

export async function listBackInStockSubscribers(): Promise<BackInStockSubscriber[]> {
  await requirePermission('inventory.read');
  const rows = await repos.backInStock.listPendingWithProduct();

  return rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    productName: row.product.name,
    productSlug: row.product.slug,
    email: row.email,
    phone: row.phone,
    createdAt: row.createdAt.toISOString(),
    inStock: row.product.variants.some(
      (v) => (v.inventory?.quantity ?? 0) - (v.inventory?.reserved ?? 0) > 0
    ),
  }));
}

/** Mark a single subscriber as notified once the admin has messaged them. */
export async function markSubscriberNotifiedAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  await requirePermission('inventory.write');
  try {
    await repos.backInStock.markNotified(id);
    revalidatePath('/admin/marketing/back-in-stock');
    return { success: true };
  } catch (error) {
    console.error('Failed to mark subscriber notified:', error);
    return { success: false, error: 'Failed to update subscriber.' };
  }
}

/**
 * Restock a variant and, if that takes the product from zero to available,
 * clear its back-in-stock queue — returning the contacts so the caller can
 * message them.
 */
export async function restockVariantAction(
  variantId: string,
  productId: string,
  change: number
): Promise<{ success: boolean; error?: string; notified?: number }> {
  await requirePermission('inventory.write');

  if (!Number.isFinite(change) || change === 0) {
    return { success: false, error: 'Enter a non-zero quantity.' };
  }

  try {
    await repos.inventory.adjustStock(variantId, change, 'admin_restock');

    let notified = 0;
    if (change > 0) {
      const subscribers = await repos.backInStock.notifyProductInStock(productId);
      notified = subscribers.length;
    }

    revalidatePath('/admin/inventory');
    revalidatePath('/admin/marketing/back-in-stock');
    return { success: true, notified };
  } catch (error) {
    console.error('Failed to restock variant:', error);
    return { success: false, error: 'Failed to adjust stock.' };
  }
}
