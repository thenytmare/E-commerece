import { describe, expect, it, vi } from 'vitest';
import { MediaLibraryRepository } from './media.repository';

function makeRepo(opts: {
  productImages?: number;
  categories?: number;
  brands?: number;
  settings?: { key: string; value: unknown }[];
}) {
  const db = {
    productImage: { count: vi.fn().mockResolvedValue(opts.productImages ?? 0) },
    category: { count: vi.fn().mockResolvedValue(opts.categories ?? 0) },
    brand: { count: vi.fn().mockResolvedValue(opts.brands ?? 0) },
    siteSetting: { findMany: vi.fn().mockResolvedValue(opts.settings ?? []) },
  };
  return new MediaLibraryRepository(db as never);
}

const url = '/uploads/2026/11/hero.webp';

describe('Media category search', () => {
  it('filters by category and images, and searches original filenames', async () => {
    const db = { mediaLibrary: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) } };
    await new MediaLibraryRepository(db as never).adminFindMany({ categoryId: 'cat', imagesOnly: true, search: 'earbud', page: 2, limit: 60 });
    expect(db.mediaLibrary.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 60, take: 60, where: expect.objectContaining({ categoryId: 'cat', mimeType: { startsWith: 'image/' }, OR: expect.arrayContaining([{ originalFilename: { contains: 'earbud', mode: 'insensitive' } }]) }) }));
  });
  it('distinguishes all files from unfiled and uncategorized files', async () => {
    const db = { mediaLibrary: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) } };
    const repo = new MediaLibraryRepository(db as never);
    await repo.adminFindMany();
    expect(db.mediaLibrary.count).toHaveBeenLastCalledWith({ where: {} });
    await repo.adminFindMany({ categoryId: null, folderId: null });
    expect(db.mediaLibrary.count).toHaveBeenLastCalledWith({ where: { categoryId: null, folderId: null } });
  });
});

describe('MediaLibraryRepository.findReferences', () => {
  it('finds nothing when the file is unused', async () => {
    const repo = makeRepo({ settings: [{ key: 'homepage', value: { hero: { imageUrl: '/other.png' } } }] });
    expect(await repo.findReferences([url])).toEqual([]);
  });

  it('blocks a file used only by the homepage hero', async () => {
    const repo = makeRepo({ settings: [{ key: 'homepage', value: { hero: { imageUrl: url } } }] });
    expect(await repo.findReferences([url])).toEqual(['the "homepage" setting']);
  });

  it('blocks a file used only by a marketing banner', async () => {
    const repo = makeRepo({ settings: [{ key: 'banners', value: [{ id: '1', imageUrl: url }] }] });
    expect(await repo.findReferences([url])).toEqual(['the "banners" setting']);
  });

  it('blocks product, category and brand uses', async () => {
    const repo = makeRepo({ productImages: 1, categories: 1, brands: 1 });
    expect(await repo.findReferences([url])).toHaveLength(3);
  });

  it('returns nothing for an empty list without querying', async () => {
    const repo = makeRepo({});
    expect(await repo.findReferences([])).toEqual([]);
  });
});
