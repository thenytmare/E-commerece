import type { Prisma, MediaLibrary } from '@prisma/client';
import { BaseRepository } from './base.repository';

export type MediaListItem = MediaLibrary;

export interface InsertMediaInput {
  url: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  extension: string;
  size: number;
  width?: number | null;
  height?: number | null;
  storageKey: string;
  alt?: string | null;
  caption?: string | null;
  folderId?: string | null;
  categoryId?: string | null;
  uploadedBy?: string | null;
}

export class MediaLibraryRepository extends BaseRepository {
  /**
   * Where these file URLs are still used on the storefront.
   *
   * Images are stored as plain URL strings, not foreign keys, so nothing in
   * the database stops a used file being deleted. This is the one place that
   * knows every content type that can hold an image. Add new ones here.
   * Returns a list of human labels, one per place a file is used.
   */
  async findReferences(urls: string[]): Promise<string[]> {
    if (urls.length === 0) return [];

    const [productImages, categories, brands, settings] = await Promise.all([
      this.db.productImage.count({ where: { url: { in: urls } } }),
      this.db.category.count({ where: { imageUrl: { in: urls } } }),
      this.db.brand.count({ where: { logoUrl: { in: urls } } }),
      // Homepage hero, banners, store settings and any other JSON setting.
      this.db.siteSetting.findMany({ select: { key: true, value: true } }),
    ]);

    const places: string[] = [];
    if (productImages > 0) places.push(`${productImages} product image(s)`);
    if (categories > 0) places.push(`${categories} categor${categories === 1 ? 'y' : 'ies'}`);
    if (brands > 0) places.push(`${brands} brand logo(s)`);

    for (const setting of settings) {
      const text = JSON.stringify(setting.value ?? null);
      if (urls.some((url) => text.includes(JSON.stringify(url).slice(1, -1)))) {
        places.push(`the "${setting.key}" setting`);
      }
    }
    return places;
  }

  async insert(data: InsertMediaInput): Promise<MediaLibrary> {
    return this.db.mediaLibrary.create({ data });
  }
  async adminFindMany(options?: {
    search?: string;
    page?: number;
    limit?: number;
    folderId?: string | null;
    categoryId?: string | null;
    imagesOnly?: boolean;
  }): Promise<{ items: MediaListItem[]; total: number }> {
    const where: Prisma.MediaLibraryWhereInput = {};
    if (options?.categoryId !== undefined) where.categoryId = options.categoryId;
    if (options?.imagesOnly) where.mimeType = { startsWith: 'image/' };
    if (options?.folderId !== undefined) {
      where.folderId = options.folderId;
    }
    if (options?.search) {
      where.OR = [
        { filename: { contains: options.search, mode: 'insensitive' } },
        { originalFilename: { contains: options.search, mode: 'insensitive' } },
        { alt: { contains: options.search, mode: 'insensitive' } },
      ];
    }
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const [items, total] = await Promise.all([
      this.db.mediaLibrary.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.db.mediaLibrary.count({ where }),
    ]);
    return { items, total };
  }

  // Folder methods
  async listAllFolders() {
    return this.db.mediaFolder.findMany({ orderBy: { name: 'asc' } });
  }

  async findFolderById(id: string) {
    return this.db.mediaFolder.findUnique({ where: { id } });
  }

  async assignCategory(fileIds: string[], categoryId: string | null) {
    return this.db.mediaLibrary.updateMany({ where: { id: { in: fileIds } }, data: { categoryId } });
  }

  async createFolder(name: string, parentId?: string | null) {
    return this.db.mediaFolder.create({ data: { name, parentId: parentId ?? null } });
  }

  async listFolders(parentId?: string | null) {
    return this.db.mediaFolder.findMany({
      where: { parentId: parentId ?? null },
      orderBy: { name: 'asc' },
      include: { children: true, _count: { select: { files: true } } },
    });
  }

  async deleteFolder(id: string) {
    return this.db.mediaFolder.delete({ where: { id } });
  }

  async moveToFolder(fileIds: string[], folderId: string | null) {
    return this.db.mediaLibrary.updateMany({
      where: { id: { in: fileIds } },
      data: { folderId },
    });
  }

  async getStats(): Promise<{ total: number; totalSize: number }> {
    const [total, agg] = await Promise.all([
      this.db.mediaLibrary.count(),
      this.db.mediaLibrary.aggregate({ _sum: { size: true } }),
    ]);
    return { total, totalSize: agg._sum.size ?? 0 };
  }

  async findById(id: string): Promise<MediaLibrary | null> {
    return this.db.mediaLibrary.findUnique({ where: { id } });
  }

  async findManyByIds(ids: string[]): Promise<MediaListItem[]> {
    return this.db.mediaLibrary.findMany({ where: { id: { in: ids } } });
  }

  async delete(id: string): Promise<MediaLibrary> {
    return this.db.mediaLibrary.delete({ where: { id } });
  }

  async bulkDelete(ids: string[]): Promise<number> {
    const r = await this.db.mediaLibrary.deleteMany({ where: { id: { in: ids } } });
    return r.count;
  }
}
