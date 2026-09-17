'use server';

import { createRepositories } from '@repo/database';
import { requirePermission } from './auth';
import { revalidatePath } from 'next/cache';
import { formatPrice } from '@/lib/format';

const repos = createRepositories();

export type FlashSaleActionState = { success?: boolean; error?: string };

export async function createFlashSaleAction(
  _prevState: FlashSaleActionState | null,
  formData: FormData
): Promise<FlashSaleActionState> {
  await requirePermission('marketing.write');

  const productId = String(formData.get('productId') ?? '').trim();
  const salePrice = Number(formData.get('salePrice'));
  const startsAtRaw = String(formData.get('startsAt') ?? '').trim();
  const endsAtRaw = String(formData.get('endsAt') ?? '').trim();

  if (!productId) return { success: false, error: 'Select a product.' };
  if (!Number.isFinite(salePrice) || salePrice <= 0) {
    return { success: false, error: 'Enter a valid sale price.' };
  }
  if (!startsAtRaw || !endsAtRaw) {
    return { success: false, error: 'Both a start and end date are required.' };
  }

  const startsAt = new Date(startsAtRaw);
  const endsAt = new Date(endsAtRaw);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return { success: false, error: 'Enter valid dates.' };
  }
  if (endsAt <= startsAt) {
    return { success: false, error: 'The end date must be after the start date.' };
  }

  try {
    // A "sale" priced at or above the product's own price isn't a discount,
    // and would quietly display as one.
    const product = await repos.product.findById(productId);
    if (!product) {
      return { success: false, error: 'That product no longer exists.' };
    }
    if (salePrice >= Number(product.basePrice)) {
      return {
        success: false,
        error: `The sale price must be below the current price of ${formatPrice(product.basePrice)}.`,
      };
    }

    const overlapping = await repos.flashSale.findOverlapping(productId, startsAt, endsAt);
    if (overlapping.length > 0) {
      return {
        success: false,
        error:
          'This product already has a sale running over those dates. Delete that one first — otherwise the cheaper of the two silently wins on the storefront.',
      };
    }

    await repos.flashSale.create({ productId, salePrice, startsAt, endsAt });
    revalidatePath('/admin/marketing/flash-sales');
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error) {
    console.error('Failed to create flash sale:', error);
    return { success: false, error: 'Failed to create flash sale.' };
  }
}

export async function deleteFlashSaleAction(id: string): Promise<FlashSaleActionState> {
  await requirePermission('marketing.write');
  try {
    await repos.flashSale.delete(id);
    revalidatePath('/admin/marketing/flash-sales');
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete flash sale:', error);
    return { success: false, error: 'Failed to delete flash sale.' };
  }
}
