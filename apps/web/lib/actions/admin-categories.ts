'use server';

import { createRepositories } from '@repo/database';
import { requirePermission } from './auth';
import { revalidatePath } from 'next/cache';
import { categorySchema, parseFormData } from '@/lib/validations/admin';

const repos = createRepositories();

export type ActionState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function createCategoryAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  await requirePermission('categories.write');

  const validation = parseFormData(categorySchema, formData);
  if (validation.fieldErrors) {
    return { error: 'Please correct the highlighted fields.', fieldErrors: validation.fieldErrors };
  }
  const { slug, ...fields } = validation.data;

  try {
    const slugTaken = await repos.category.isSlugTaken(slug);
    if (slugTaken) {
      return { error: 'A category with this slug already exists.', fieldErrors: { slug: 'Already taken' } };
    }

    const parentIdRaw = formData.get('parentId');
    const parentId = parentIdRaw && parentIdRaw !== 'null' ? String(parentIdRaw) : null;

    await repos.category.create({ ...fields, slug, parentId });

    revalidatePath('/admin/catalog/categories');
    return { success: true };
  } catch (error) {
    console.error('Failed to create category:', error);
    return { error: 'Failed to create category.' };
  }
}

export async function updateCategoryAction(
  id: string,
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  await requirePermission('categories.write');

  const validation = parseFormData(categorySchema, formData);
  if (validation.fieldErrors) {
    return { error: 'Please correct the highlighted fields.', fieldErrors: validation.fieldErrors };
  }
  const { slug, ...fields } = validation.data;

  try {
    // Check slug uniqueness (exclude self)
    const slugTaken = await repos.category.isSlugTaken(slug, id);
    if (slugTaken) {
      return { error: 'A category with this slug already exists.', fieldErrors: { slug: 'Already taken' } };
    }

    const parentIdRaw = formData.get('parentId');
    const parentId = parentIdRaw && parentIdRaw !== 'null' && parentIdRaw !== 'undefined' ? String(parentIdRaw) : null;

    // Prevent circular parent references
    if (parentId) {
      const wouldCircular = await repos.category.wouldCauseCircularReference(id, parentId);
      if (wouldCircular) {
        return { error: 'Cannot set this category as its own parent or descendant.', fieldErrors: { parentId: 'Invalid parent' } };
      }
    }

    await repos.category.update(id, { ...fields, slug, parentId });

    revalidatePath('/admin/catalog/categories');
    revalidatePath(`/admin/catalog/categories/${id}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to update category:', error);
    return { error: 'Failed to update category.' };
  }
}

export async function softDeleteCategoryAction(id: string): Promise<{ success: boolean; error?: string }> {
  await requirePermission('categories.delete');
  try {
    await repos.category.softDelete(id);
    revalidatePath('/admin/catalog/categories');
    return { success: true };
  } catch (error) {
    console.error('Failed to soft-delete category:', error);
    return { success: false, error: 'Failed to delete category.' };
  }
}

export async function restoreCategoryAction(id: string): Promise<{ success: boolean; error?: string }> {
  await requirePermission('categories.write');
  try {
    await repos.category.restore(id);
    revalidatePath('/admin/catalog/categories');
    return { success: true };
  } catch (error) {
    console.error('Failed to restore category:', error);
    return { success: false, error: 'Failed to restore category.' };
  }
}

export async function deleteCategoryAction(id: string): Promise<{ success: boolean; error?: string }> {
  await requirePermission('categories.delete');
  try {
    await repos.category.delete(id);
    revalidatePath('/admin/catalog/categories');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete category:', error);
    return { success: false, error: 'Failed to delete category. It may have products assigned.' };
  }
}

export async function bulkActionCategories(
  ids: string[],
  action: 'soft-delete' | 'restore' | 'activate' | 'deactivate' | 'permanent-delete'
): Promise<{ success: boolean; error?: string; count?: number }> {
  await requirePermission('categories.write');

  try {
    let count = 0;
    switch (action) {
      case 'soft-delete':
        await requirePermission('categories.delete');
        count = await repos.category.bulkSoftDelete(ids);
        break;
      case 'restore':
        count = await repos.category.bulkRestore(ids);
        break;
      case 'activate':
        count = await repos.category.bulkSetActive(ids, true);
        break;
      case 'deactivate':
        count = await repos.category.bulkSetActive(ids, false);
        break;
      case 'permanent-delete':
        await requirePermission('categories.delete');
        count = await repos.category.bulkDelete(ids);
        break;
    }
    revalidatePath('/admin/catalog/categories');
    return { success: true, count };
  } catch (error) {
    console.error(`Bulk action "${action}" failed:`, error);
    return { success: false, error: `Bulk ${action} failed.` };
  }
}