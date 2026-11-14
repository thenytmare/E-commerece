import type { Brand, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';

export type AdminBrandListItem = Prisma.BrandGetPayload<{
  include: { _count: { select: { products: true } } };
}>;

export interface CreateBrandInput {
  name: string;
  slug: string;
  logoUrl?: string | null;
  description?: string | null;
  website?: string | null;
  country?: string | null;
  isFeatured?: boolean;
  isActive?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export type UpdateBrandInput = Partial<CreateBrandInput>;

/** Data access for product brands. */
export class BrandRepository extends BaseRepository {
  /** Find an active brand by URL slug. */
  async findBySlug(slug: string): Promise<Brand | null> {
    return this.db.brand.findFirst({ where: { slug, isActive: true, deletedAt: null } });
  }

  /** List active brands ordered by name. */
  async findAllActive(): Promise<Brand[]> {
    return this.db.brand.findMany({ where: { isActive: true, deletedAt: null }, orderBy: { name: 'asc' } });
  }

  /** List brands for catalog administration with product counts, filtering & pagination. */
  async adminFindMany(options?: {
    search?: string;
    isActive?: boolean;
    isDeleted?: boolean;
    isFeatured?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ items: AdminBrandListItem[]; total: number }> {
    const where: Prisma.BrandWhereInput = {};

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { slug: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    if (options?.isDeleted) {
      where.deletedAt = { not: null };
    } else {
      where.deletedAt = null;
    }

    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }
    if (options?.isFeatured !== undefined) {
      where.isFeatured = options.isFeatured;
    }

    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.db.brand.findMany({
        where,
        include: { _count: { select: { products: true } } },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.db.brand.count({ where }),
    ]);

    return { items, total };
  }

  async findById(id: string): Promise<Brand | null> {
    return this.db.brand.findUnique({ where: { id } });
  }

  /** Check if a slug is already taken (optionally excluding a brand ID) */
  async isSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
    const where: Prisma.BrandWhereInput = { slug };
    if (excludeId) where.id = { not: excludeId };
    const count = await this.db.brand.count({ where });
    return count > 0;
  }

  /** Get brand statistics for dashboard */
  async getStats(): Promise<{ total: number; active: number; deleted: number; featured: number }> {
    const [total, active, deleted, featured] = await Promise.all([
      this.db.brand.count({ where: { deletedAt: null } }),
      this.db.brand.count({ where: { isActive: true, deletedAt: null } }),
      this.db.brand.count({ where: { deletedAt: { not: null } } }),
      this.db.brand.count({ where: { isFeatured: true, deletedAt: null } }),
    ]);
    return { total, active, deleted, featured };
  }

  async create(data: CreateBrandInput): Promise<Brand> {
    return this.db.brand.create({ data });
  }

  async update(id: string, data: UpdateBrandInput): Promise<Brand> {
    return this.db.brand.update({ where: { id }, data });
  }

  /** Soft delete a brand */
  async softDelete(id: string): Promise<Brand> {
    return this.db.brand.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  /** Restore a soft-deleted brand */
  async restore(id: string): Promise<Brand> {
    return this.db.brand.update({ where: { id }, data: { deletedAt: null } });
  }

  async delete(id: string): Promise<Brand> {
    return this.db.brand.delete({ where: { id } });
  }

  /** Bulk soft delete */
  async bulkSoftDelete(ids: string[]): Promise<number> {
    const result = await this.db.brand.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: new Date(), isActive: false },
    });
    return result.count;
  }

  /** Bulk restore */
  async bulkRestore(ids: string[]): Promise<number> {
    const result = await this.db.brand.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: null },
    });
    return result.count;
  }

  /** Bulk set active status */
  async bulkSetActive(ids: string[], isActive: boolean): Promise<number> {
    const result = await this.db.brand.updateMany({
      where: { id: { in: ids } },
      data: { isActive },
    });
    return result.count;
  }

  /** Bulk hard delete */
  async bulkDelete(ids: string[]): Promise<number> {
    const result = await this.db.brand.deleteMany({ where: { id: { in: ids } } });
    return result.count;
  }
}