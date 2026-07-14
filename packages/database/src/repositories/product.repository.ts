import type { Prisma, Product } from '@prisma/client';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@repo/config';
import { BaseRepository } from './base.repository';

const productListInclude = {
  brand: { select: { name: true, slug: true } },
  category: { select: { name: true, slug: true } },
  images: {
    where: { isFeatured: true },
    take: 1,
    orderBy: { sortOrder: 'asc' as const },
  },
  variants: {
    where: { isDefault: true },
    take: 1,
    select: { price: true, compareAtPrice: true },
  },
} satisfies Prisma.ProductInclude;

export type ProductListItem = Prisma.ProductGetPayload<{ include: typeof productListInclude }>;

const productDetailInclude = {
  brand: true,
  category: true,
  variants: {
    include: { inventory: true },
    orderBy: { isDefault: 'desc' as const },
  },
  images: { orderBy: { sortOrder: 'asc' as const } },
  specs: { orderBy: { sortOrder: 'asc' as const } },
  features: { orderBy: { sortOrder: 'asc' as const } },
  boxContents: { orderBy: { sortOrder: 'asc' as const } },
} satisfies Prisma.ProductInclude;

export type ProductDetail = Prisma.ProductGetPayload<{ include: typeof productDetailInclude }>;

export interface ProductListFilters {
  categoryId?: string;
  brandId?: string;
  isFeatured?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedProducts {
  items: ProductListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Data access for products and catalog listings.
 */
export class ProductRepository extends BaseRepository {
  /** Find a product by URL slug with full detail relations */
  findBySlug(slug: string): Promise<ProductDetail | null> {
    return this.db.product.findFirst({
      where: { slug, isActive: true },
      include: productDetailInclude,
    });
  }

  /** Find a product by ID with full detail relations */
  findById(id: string): Promise<ProductDetail | null> {
    return this.db.product.findFirst({
      where: { id, isActive: true },
      include: productDetailInclude,
    });
  }

  /** Paginated product listing with optional filters */
  async findMany(filters: ProductListFilters = {}): Promise<PaginatedProducts> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.limit ?? DEFAULT_PAGE_SIZE));
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      ...(filters.categoryId && { categoryId: filters.categoryId }),
      ...(filters.brandId && { brandId: filters.brandId }),
      ...(filters.isFeatured !== undefined && { isFeatured: filters.isFeatured }),
      ...(filters.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { shortDescription: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.db.product.findMany({
        where,
        include: productListInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.db.product.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Create a new product */
  create(data: Prisma.ProductCreateInput): Promise<Product> {
    return this.db.product.create({ data });
  }
}
