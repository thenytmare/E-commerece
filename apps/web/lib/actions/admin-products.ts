'use server';

import { createRepositories } from '@repo/database';
import { requireAdmin } from './auth';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';

const repos = createRepositories();

export type ActionState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function createProductAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  
  try {
    const basePrice = Number(formData.get('basePrice'));
    const compareAtPriceRaw = formData.get('compareAtPrice');
    const compareAtPrice = compareAtPriceRaw ? Number(compareAtPriceRaw) : null;
    
    await repos.product.create({
      name: String(formData.get('name') ?? ''),
      slug: String(formData.get('slug') ?? ''),
      brandId: String(formData.get('brandId') ?? ''),
      categoryId: String(formData.get('categoryId') ?? ''),
      basePrice,
      compareAtPrice,
      description: formData.get('description') as string | null,
      shortDescription: formData.get('shortDescription') as string | null,
      isFeatured: formData.get('isFeatured') === 'on',
      isActive: formData.get('isActive') === 'on',
      seoTitle: formData.get('seoTitle') as string | null,
      seoDescription: formData.get('seoDescription') as string | null,
    });
    
    revalidatePath('/admin/catalog/products');
    return { success: true };
  } catch (error) {
    console.error('Failed to create product:', error);
    return { error: 'Failed to create product. Ensure slug is unique.' };
  }
}

export async function updateProductAction(
  id: string,
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  
  try {
    const basePrice = Number(formData.get('basePrice'));
    const compareAtPriceRaw = formData.get('compareAtPrice');
    const compareAtPrice = compareAtPriceRaw ? Number(compareAtPriceRaw) : null;
    
    await repos.product.update(id, {
      name: String(formData.get('name') ?? ''),
      slug: String(formData.get('slug') ?? ''),
      brandId: formData.get('brandId') as string,
      categoryId: formData.get('categoryId') as string,
      basePrice,
      compareAtPrice,
      description: formData.get('description') as string | null,
      shortDescription: formData.get('shortDescription') as string | null,
      isFeatured: formData.get('isFeatured') === 'on',
      isActive: formData.get('isActive') === 'on',
      seoTitle: formData.get('seoTitle') as string | null,
      seoDescription: formData.get('seoDescription') as string | null,
    });
    
    revalidatePath('/admin/catalog/products');
    revalidatePath(`/admin/catalog/products/${id}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to update product:', error);
    return { error: 'Failed to update product.' };
  }
}

export async function deleteProductAction(id: string): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  try {
    await repos.product.delete(id);
    revalidatePath('/admin/catalog/products');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete product:', error);
    return { success: false, error: 'Failed to delete product.' };
  }
}

export async function toggleProductStatusAction(id: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  try {
    await repos.product.update(id, { isActive });
    revalidatePath('/admin/catalog/products');
    return { success: true };
  } catch (error) {
    console.error('Failed to toggle product status:', error);
    return { success: false, error: 'Failed to toggle product status.' };
  }
}
