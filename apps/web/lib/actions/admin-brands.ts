'use server';

import { createRepositories } from '@repo/database';
import { requirePermission } from './auth';
import { revalidatePath } from 'next/cache';
import { brandSchema, parseFormData, type FieldErrors } from '@/lib/validations/admin';

type BrandActionState = { success?: boolean; error?: string; fieldErrors?: FieldErrors };
const repos = createRepositories();

export async function createBrandAction(_previous: BrandActionState | null, formData: FormData): Promise<BrandActionState> {
  await requirePermission('brands.write');

  const validation = parseFormData(brandSchema, formData);
  if (validation.fieldErrors) {
    return { error: 'Please correct the highlighted fields.', fieldErrors: validation.fieldErrors };
  }
  const data = validation.data;

  try {
    const taken = await repos.brand.isSlugTaken(data.slug);
    if (taken) return { error: 'A brand with this slug already exists.', fieldErrors: { slug: 'Already taken' } };
    await repos.brand.create(data);
    revalidatePath('/admin/catalog/brands');
    return { success: true };
  } catch (error) {
    console.error('Failed to create brand:', error);
    return { error: 'Could not create the brand.' };
  }
}

export async function updateBrandAction(id: string, _previous: BrandActionState | null, formData: FormData): Promise<BrandActionState> {
  await requirePermission('brands.write');

  const validation = parseFormData(brandSchema, formData);
  if (validation.fieldErrors) {
    return { error: 'Please correct the highlighted fields.', fieldErrors: validation.fieldErrors };
  }
  const data = validation.data;

  try {
    const taken = await repos.brand.isSlugTaken(data.slug, id);
    if (taken) return { error: 'A brand with this slug already exists.', fieldErrors: { slug: 'Already taken' } };
    await repos.brand.update(id, data);
    revalidatePath('/admin/catalog/brands');
    revalidatePath(`/admin/catalog/brands/${id}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to update brand:', error);
    return { error: 'Could not update the brand.' };
  }
}

export async function deleteBrandAction(id: string) {
  await requirePermission('brands.delete');
  try {
    await repos.brand.delete(id);
    revalidatePath('/admin/catalog/brands');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete brand:', error);
    return { success: false, error: 'Could not delete this brand while products are assigned to it.' };
  }
}

export async function softDeleteBrandAction(id: string): Promise<BrandActionState> {
  await requirePermission('brands.delete');
  try {
    await repos.brand.softDelete(id);
    revalidatePath('/admin/catalog/brands');
    return { success: true };
  } catch (error) {
    console.error('Failed to archive brand:', error);
    return { success: false, error: 'Failed to archive brand.' };
  }
}

export async function restoreBrandAction(id: string): Promise<BrandActionState> {
  await requirePermission('brands.write');
  try {
    await repos.brand.restore(id);
    revalidatePath('/admin/catalog/brands');
    return { success: true };
  } catch (error) {
    console.error('Failed to restore brand:', error);
    return { success: false, error: 'Failed to restore brand.' };
  }
}

export async function bulkActionBrands(
  ids: string[],
  action: 'soft-delete' | 'restore' | 'activate' | 'deactivate' | 'permanent-delete'
): Promise<{ success: boolean; error?: string; count?: number }> {
  await requirePermission('brands.write');
  try {
    let count = 0;
    switch (action) {
      case 'soft-delete':
        await requirePermission('brands.delete');
        count = await repos.brand.bulkSoftDelete(ids);
        break;
      case 'restore':
        count = await repos.brand.bulkRestore(ids);
        break;
      case 'activate':
        count = await repos.brand.bulkSetActive(ids, true);
        break;
      case 'deactivate':
        count = await repos.brand.bulkSetActive(ids, false);
        break;
      case 'permanent-delete':
        await requirePermission('brands.delete');
        count = await repos.brand.bulkDelete(ids);
        break;
    }
    revalidatePath('/admin/catalog/brands');
    return { success: true, count };
  } catch (error) {
    console.error(`Bulk ${action} failed:`, error);
    return { success: false, error: `Bulk ${action} failed.` };
  }
}