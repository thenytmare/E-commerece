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
  uploadedBy?: string | null;
}

export class MediaLibraryRepository extends BaseRepository {
  async insert(data: InsertMediaInput): Promise<MediaLibrary> {
    return this.db.mediaLibrary.create({ data });
  }
  async adminFindMany(options?: {
    search?: string;
    page?: number;
    limit?: number;
    folderId?: string | null;
  }): Promise<{ items: MediaListItem[]; total: number }> {
    const where: Prisma.MediaLibraryWhereInput = {};
    if (options?.folderId !== undefined) {
      where.folderId = options.folderId;
    }
    if (options?.search) {
      where.OR = [
        { filename: { contains: options.search, mode: 'insensitive' } },
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