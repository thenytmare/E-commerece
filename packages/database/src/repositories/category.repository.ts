import type { Category, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';

export interface CreateCategoryInput {
  name: string;
  slug: string;
  parentId?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  isFeatured?: boolean;
  isActive?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  sortOrder?: number;
}

export type UpdateCategoryInput = Partial<CreateCategoryInput>;

const categoryWithChildrenInclude = {
  children: {
    where: { isActive: true, deletedAt: null },
    orderBy: { sortOrder: 'asc' as const },
  },
} satisfies Prisma.CategoryInclude;

export type CategoryWithChildren = Prisma.CategoryGetPayload<{
  include: typeof categoryWithChildrenInclude;
}>;

const adminCategoryListInclude = {
  parent: { select: { id: true, name: true, slug: true } },
  _count: { select: { products: true, children: true } },
} satisfies Prisma.CategoryInclude;

export type AdminCategoryListItem = Prisma.CategoryGetPayload<{
  include: typeof adminCategoryListInclude;
}>;

/**
 * Data access for product categories and hierarchy.
 */
export class CategoryRepository extends BaseRepository {
  /** Find an active (non-deleted) category by URL slug */
  async findBySlug(slug: string): Promise<Category | null> {
    return this.db.category.findFirst({
      where: { slug, isActive: true, deletedAt: null },
    });
  }

  /** Find a category by ID (including soft-deleted) */
  async findById(id: string): Promise<Category | null> {
    return this.db.category.findUnique({ where: { id } });
  }

  /** Find a category with parent and children (for edit page) */
  async findByIdForEdit(id: string) {
    return this.db.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  /** Check if a slug is already taken (optionally excluding a category ID) */
  async isSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
    const where: Prisma.CategoryWhereInput = { slug };
    if (excludeId) {
      where.id = { not: excludeId };
    }
    const count = await this.db.category.count({ where });
    return count > 0;
  }

  /** Check if setting parentId would cause a circular reference */
  async wouldCauseCircularReference(id: string, parentId: string): Promise<boolean> {
    let currentId: string | null = parentId;
    const visited = new Set<string>();
    while (currentId) {
      if (currentId === id || visited.has(currentId)) return true;
      visited.add(currentId);
      const parentCategory: { parentId: string | null } | null = await this.db.category.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });
      currentId = parentCategory?.parentId ?? null;
    }
    return false;
  }

  /** Get top-level categories with their active children */
  async findRootCategories(): Promise<CategoryWithChildren[]> {
    return this.db.category.findMany({
      where: { parentId: null, isActive: true, deletedAt: null },
      include: categoryWithChildrenInclude,
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** Get all categories for Admin (flat list with counts, supports filtering & pagination) */
  async adminFindMany(options?: {
    search?: string;
    isActive?: boolean;
    isDeleted?: boolean;
    parentId?: string | null;
    isFeatured?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ items: AdminCategoryListItem[]; total: number }> {
    const where: Prisma.CategoryWhereInput = {};

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { slug: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    if (options?.isDeleted) {
      where.deletedAt = { not: null };
    } else if (options?.isDeleted === false) {
      where.deletedAt = null;
    } else {
      where.deletedAt = null;
    }

    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }
    if (options?.parentId !== undefined) {
      where.parentId = options.parentId;
    }
    if (options?.isFeatured !== undefined) {
      where.isFeatured = options.isFeatured;
    }

    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.db.category.findMany({
        where,
        include: adminCategoryListInclude,
        orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }],
        skip,
        take: limit,
      }),
      this.db.category.count({ where }),
    ]);

    return { items, total };
  }

  /** Get category statistics for dashboard widgets */
  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    deleted: number;
    featured: number;
    emptyCount: number;
  }> {
    const [total, active, deleted, featured, allCategories] = await Promise.all([
      this.db.category.count({ where: { deletedAt: null } }),
      this.db.category.count({ where: { isActive: true, deletedAt: null } }),
      this.db.category.count({ where: { deletedAt: { not: null } } }),
      this.db.category.count({ where: { isFeatured: true, deletedAt: null } }),
      this.db.category.findMany({
        where: { deletedAt: null },
        include: { _count: { select: { products: true, children: true } } },
      }),
    ]);

    const emptyCount = allCategories.filter(
      (c) => c._count.products === 0 && c._count.children === 0,
    ).length;

    return { total, active, inactive: total - active, deleted, featured, emptyCount };
  }

  /** Create a new category */
  async create(data: CreateCategoryInput): Promise<Category> {
    return this.db.category.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        imageUrl: data.imageUrl,
        isFeatured: data.isFeatured ?? false,
        isActive: data.isActive ?? true,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
        sortOrder: data.sortOrder ?? 0,
        ...(data.parentId ? { parent: { connect: { id: data.parentId } } } : {}),
      },
    });
  }

  /** Update an existing category */
  async update(id: string, data: UpdateCategoryInput): Promise<Category> {
    return this.db.category.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.isFeatured !== undefined && { isFeatured: data.isFeatured }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.seoTitle !== undefined && { seoTitle: data.seoTitle }),
        ...(data.seoDescription !== undefined && { seoDescription: data.seoDescription }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.parentId === null
          ? { parent: { disconnect: true } }
          : data.parentId
            ? { parent: { connect: { id: data.parentId } } }
            : {}),
      },
    });
  }

  /** Soft delete a category (sets deletedAt) */
  async softDelete(id: string): Promise<Category> {
    return this.db.category.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  /** Restore a soft-deleted category */
  async restore(id: string): Promise<Category> {
    return this.db.category.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  /** Hard delete a category (permanent) */
  async delete(id: string): Promise<Category> {
    return this.db.category.delete({ where: { id } });
  }

  /** Bulk soft delete */
  async bulkSoftDelete(ids: string[]): Promise<number> {
    const result = await this.db.category.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: new Date(), isActive: false },
    });
    return result.count;
  }

  /** Bulk restore */
  async bulkRestore(ids: string[]): Promise<number> {
    const result = await this.db.category.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: null },
    });
    return result.count;
  }

  /** Bulk set active status */
  async bulkSetActive(ids: string[], isActive: boolean): Promise<number> {
    const result = await this.db.category.updateMany({
      where: { id: { in: ids } },
      data: { isActive },
    });
    return result.count;
  }

  /** Bulk hard delete (permanently removes soft-deleted categories) */
  async bulkDelete(ids: string[]): Promise<number> {
    const result = await this.db.category.deleteMany({
      where: { id: { in: ids } },
    });
    return result.count;
  }
}