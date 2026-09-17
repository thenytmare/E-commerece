'use server';

import { createRepositories, prisma } from '@repo/database';
import { revalidatePath } from 'next/cache';
import { requirePermission } from './auth';
import { unlink } from 'fs/promises';
import path from 'path';

const repos = createRepositories();

/** Best-effort removal of uploaded files from local disk storage. */
async function deleteFilesFor(urls: (string | null)[]): Promise<void> {
  await Promise.all(
    urls
      .filter((url): url is string => !!url?.startsWith('/uploads/'))
      .map(async (url) => {
        try {
          await unlink(path.join(process.cwd(), 'public', url));
        } catch {
          // File already gone or unreadable — don't block the DB delete on this.
        }
      })
  );
}

/**
 * Count catalog records still pointing at these URLs.
 *
 * Product images, category images, and brand logos all store a bare URL string
 * rather than a foreign key into the media library, so nothing at the database
 * level stops a file that's still on the storefront from being deleted. This
 * is that missing check.
 */
async function countReferences(urls: string[]): Promise<number> {
  if (urls.length === 0) return 0;

  const [productImages, categories, brands] = await Promise.all([
    prisma.productImage.count({ where: { url: { in: urls } } }),
    prisma.category.count({ where: { imageUrl: { in: urls } } }),
    prisma.brand.count({ where: { logoUrl: { in: urls } } }),
  ]);

  return productImages + categories + brands;
}

function inUseMessage(count: number): string {
  const noun = count === 1 ? 'place' : 'places';
  return `Still used in ${count} ${noun} on the storefront. Remove it from those first, or choose "Delete anyway".`;
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
      if (references > 0) {
        return { success: false, error: inUseMessage(references), inUse: references };
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
      if (references > 0) {
        return { success: false, error: inUseMessage(references), inUse: references };
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
