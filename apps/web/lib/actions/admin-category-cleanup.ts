'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { createRepositories } from '@repo/database';
import { requirePermission } from './auth';
import { applyCategoryCleanup, CleanupBlockedError } from '@/lib/admin/category-cleanup';
import { CATALOG_TAG } from '@/lib/catalog-cache';
import { getClientIp } from '@/lib/request-context';

const repos = createRepositories();

/** Saves the category clean-up shown on Settings > Category clean-up. Admins only. */
export async function applyCategoryCleanupAction(): Promise<{ success: boolean; message: string }> {
  const session = await requirePermission('settings.write');
  try {
    const result = await applyCategoryCleanup();
    await repos.auditLog.create({
      actorId: session.user.id,
      ipAddress: (await getClientIp()) ?? undefined,
      action: 'category.cleanup',
      entity: 'Category',
      entityId: 'cleanup-2026-11',
      metadata: result,
    });
    revalidateTag(CATALOG_TAG);
    revalidatePath('/admin/settings/category-cleanup');
    revalidatePath('/admin/catalog/categories');
    return {
      success: true,
      message: `Done. ${result.moved} products moved, ${result.removed} old categories removed${result.created ? `, ${result.created} new categories created` : ''}.`,
    };
  } catch (error) {
    if (error instanceof CleanupBlockedError) return { success: false, message: error.message };
    console.error('Category clean-up failed:', error);
    return { success: false, message: 'The clean-up could not be saved. Nothing was changed. Please try again.' };
  }
}
