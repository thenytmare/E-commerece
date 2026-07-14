import type { Category, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';

const categoryWithChildren = {
  children: {
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' as const },
  },
} satisfies Prisma.CategoryInclude;

export type CategoryWithChildren = Prisma.CategoryGetPayload<{
  include: typeof categoryWithChildren;
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

  /** Get top-level categories with their active children */
  findRootCategories(): Promise<CategoryWithChildren[]> {
    return this.db.category.findMany({
      where: { parentId: null, isActive: true },
      include: categoryWithChildren,
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** Create a new category */
  create(data: Prisma.CategoryCreateInput): Promise<Category> {
    return this.db.category.create({ data });
  }
}
