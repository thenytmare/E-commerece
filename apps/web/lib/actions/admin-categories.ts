'use server';

import { createRepositories } from '@repo/database';
import { requireAdmin } from './auth';
import { revalidatePath } from 'next/cache';

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
  await requireAdmin();
  
  try {
    const parentIdRaw = formData.get('parentId');
    const parentId = parentIdRaw && parentIdRaw !== 'null' ? String(parentIdRaw) : null;
    const sortOrderRaw = formData.get('sortOrder');
    const sortOrder = sortOrderRaw ? parseInt(String(sortOrderRaw), 10) : 0;
    
    await repos.category.create({
      name: String(formData.get('name') ?? ''),
      slug: String(formData.get('slug') ?? ''),
      parentId,
      isActive: formData.get('isActive') === 'on',
      seoTitle: formData.get('seoTitle') as string | null,
      seoDescription: formData.get('seoDescription') as string | null,
      sortOrder,
    });
    
    revalidatePath('/admin/catalog/categories');
    return { success: true };
  } catch (error) {
    console.error('Failed to create category:', error);
    return { error: 'Failed to create category. Ensure slug is unique.' };
  }
}

export async function updateCategoryAction(
  id: string,
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  
  try {
    const parentIdRaw = formData.get('parentId');
    const parentId = parentIdRaw && parentIdRaw !== 'null' && parentIdRaw !== 'undefined' ? String(parentIdRaw) : null;
    const sortOrderRaw = formData.get('sortOrder');
    const sortOrder = sortOrderRaw ? parseInt(String(sortOrderRaw), 10) : 0;
    
    await repos.category.update(id, {
      name: String(formData.get('name') ?? ''),
      slug: String(formData.get('slug') ?? ''),
      parentId,
      isActive: formData.get('isActive') === 'on',
      seoTitle: formData.get('seoTitle') as string | null,
      seoDescription: formData.get('seoDescription') as string | null,
      sortOrder,
    });
    
    revalidatePath('/admin/catalog/categories');
    revalidatePath(`/admin/catalog/categories/${id}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to update category:', error);
    return { error: 'Failed to update category.' };
  }
}

export async function deleteCategoryAction(id: string): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  try {
    await repos.category.delete(id);
    revalidatePath('/admin/catalog/categories');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete category:', error);
    return { success: false, error: 'Failed to delete category. It may have products assigned.' };
  }
}
