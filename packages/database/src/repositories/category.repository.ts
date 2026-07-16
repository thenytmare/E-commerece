import type { Category, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';

export interface CreateCategoryInput {
  name: string;
  slug: string;
  parentId?: string | null;
  isActive?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  sortOrder?: number;
}

export type UpdateCategoryInput = Partial<CreateCategoryInput>;

const categoryWithChildren = {
  children: {
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' as const },
  },
} satisfies Prisma.CategoryInclude;

export type CategoryWithChildren = Prisma.CategoryGetPayload<{
  include: typeof categoryWithChildren;
}>;

const adminCategoryListInclude = {
  parent: { select: { id: true, name: true } },
  _count: { select: { products: true, children: true } },
} satisfies Prisma.CategoryInclude;

export type AdminCategoryListItem = Prisma.CategoryGetPayload<{
  include: typeof adminCategoryListInclude;
}>;

/**
 * Data access for product categories and hierarchy.
 */
export class CategoryRepository extends BaseRepository {
  /** Find an active category by URL slug */
  findBySlug(slug: string): Promise<Category | null> {
    return this.db.category.findFirst({
      where: { slug, isActive: true },
    });
  }

  /** Find a category by ID (admin view) */
  findById(id: string): Promise<Category | null> {
    return this.db.category.findUnique({
      where: { id },
    });
  }

  /** Get top-level categories with their active children */
  findRootCategories(): Promise<CategoryWithChildren[]> {
    return this.db.category.findMany({
      where: { parentId: null, isActive: true },
      include: categoryWithChildren,
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** Get all categories for Admin (flat list with counts) */
  async adminFindMany(search?: string): Promise<AdminCategoryListItem[]> {
    const where: Prisma.CategoryWhereInput = search
      ? { name: { contains: search, mode: 'insensitive' } }
      : {};

    return this.db.category.findMany({
      where,
      include: adminCategoryListInclude,
      orderBy: [
        { parentId: 'asc' },
        { sortOrder: 'asc' },
      ],
    });
  }

  /** Create a new category */
  create(data: CreateCategoryInput): Promise<Category> {
    return this.db.category.create({
      data: {
        name: data.name,
        slug: data.slug,
        isActive: data.isActive ?? true,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
        sortOrder: data.sortOrder ?? 0,
        ...(data.parentId ? { parent: { connect: { id: data.parentId } } } : {}),
      },
    });
  }

  /** Update an existing category */
  update(id: string, data: UpdateCategoryInput): Promise<Category> {
    return this.db.category.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        isActive: data.isActive,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
        sortOrder: data.sortOrder,
        ...(data.parentId === null 
            ? { parent: { disconnect: true } }
            : data.parentId 
              ? { parent: { connect: { id: data.parentId } } }
              : {}),
      },
    });
  }

  /** Delete a category */
  delete(id: string): Promise<Category> {
    return this.db.category.delete({
      where: { id },
    });
  }
}
