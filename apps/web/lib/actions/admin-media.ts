'use server';

import { createRepositories } from '@repo/database';
import { revalidatePath } from 'next/cache';
import { requirePermission } from './auth';
import { getStorage } from '@/lib/media/storage-driver';

const repos = createRepositories();

/** Best-effort removal of uploaded files from the storage driver (local disk or S3). */
async function deleteFilesFor(urls: (string | null)[]): Promise<void> {
  await Promise.all(
    urls
      .filter((url): url is string => !!url?.startsWith('/uploads/'))
      .map(async (url) => {
        try {
          await getStorage().remove(decodeURIComponent(url.slice('/uploads/'.length)));
        } catch {
          // File already gone or unreadable — don't block the DB delete on this.
        }
      })
  );
}

/** Places these files are still used, from the one shared check in the repository. */
async function countReferences(urls: string[]): Promise<string[]> {
  return repos.media.findReferences(urls);
}

function inUseMessage(places: string[]): string {
  return `Still used in: ${places.join(', ')}. Remove it from those first, or choose "Delete anyway".`;
}

export async function deleteMediaAction(
  id: string,
  options: { force?: boolean } = {}
): Promise<{ success: boolean; error?: string; inUse?: number }> {
  await requirePermission('media.delete');
  try {
    const record = await repos.media.findById(id);
    if (!record) {
      return { success: false, error: 'That file no longer exists.' };
    }

    if (!options.force) {
      const references = await countReferences([record.url]);
      if (references.length > 0) {
        return { success: false, error: inUseMessage(references), inUse: references.length };
      }
    }

    const deleted = await repos.media.delete(id);
    await deleteFilesFor([deleted.url]);
    revalidatePath('/admin/media');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to delete media.' };
  }
}

/** Move files into a folder (or back to the root when folderId is null). */
export async function moveMediaToFolderAction(
  ids: string[],
  folderId: string | null
): Promise<{ success: boolean; error?: string; count?: number }> {
  await requirePermission('media.write');
  if (ids.length === 0) return { success: true, count: 0 };

  try {
    const result = await repos.media.moveToFolder(ids, folderId);
    revalidatePath('/admin/media');
    return { success: true, count: result.count };
  } catch (error) {
    console.error('Failed to move media:', error);
    return { success: false, error: 'Failed to move files.' };
  }
}

/** Organize existing uploads using the same categories as the product catalog. */
export async function assignMediaCategoryAction(ids: string[], categoryId: string | null) {
  await requirePermission('media.write');
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200 || ids.some(id => typeof id !== 'string')) {
    return { success: false, error: 'Select between 1 and 200 files.' };
  }
  try {
    if (categoryId !== null) {
      const category = await repos.category.findById(categoryId);
      if (!category || category.deletedAt) return { success: false, error: 'Category not found.' };
    }
    await repos.media.assignCategory(ids, categoryId);
    revalidatePath('/admin/media');
    return { success: true };
  } catch {
    return { success: false, error: 'Could not assign the category.' };
  }
}

export async function bulkDeleteMediaAction(
  ids: string[],
  options: { force?: boolean } = {}
): Promise<{ success: boolean; count?: number; error?: string; inUse?: number }> {
  await requirePermission('media.delete');
  if (ids.length === 0) return { success: true, count: 0 };

  try {
    const records = await repos.media.findManyByIds(ids);

    if (!options.force) {
      const references = await countReferences(records.map((record) => record.url));
      if (references.length > 0) {
        return { success: false, error: inUseMessage(references), inUse: references.length };
      }
    }

    const count = await repos.media.bulkDelete(ids);
    await deleteFilesFor(records.map((r) => r.url));
    revalidatePath('/admin/media');
    return { success: true, count };
  } catch {
    return { success: false, error: 'Failed to delete the selected files.' };
  }
}
