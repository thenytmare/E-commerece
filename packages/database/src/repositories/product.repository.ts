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

export interface AdminProductListFilters extends ProductListFilters {
  isActive?: boolean;
}

export interface PaginatedProducts {
  items: ProductListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateProductInput {
  name: string;
  slug: string;
  brandId: string;
  categoryId: string;
  basePrice: number | Prisma.Decimal;
  compareAtPrice?: number | Prisma.Decimal | null;
  description?: string | null;
  shortDescription?: string | null;
  isFeatured?: boolean;
  isActive?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export type UpdateProductInput = Partial<CreateProductInput>;

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
  findById(id: string, includeInactive = false): Promise<ProductDetail | null> {
    return this.db.product.findFirst({
      where: { id, ...(includeInactive ? {} : { isActive: true }) },
      include: productDetailInclude,
    });
  }

  /** Paginated product listing (Admin allows fetching inactive) */
  async adminFindMany(filters: AdminProductListFilters = {}): Promise<PaginatedProducts> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.limit ?? DEFAULT_PAGE_SIZE));
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
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

  /** Paginated product listing (Storefront, only active) */
  findMany(filters: ProductListFilters = {}): Promise<PaginatedProducts> {
    return this.adminFindMany({ ...filters, isActive: true });
  }

  /** Create a new product */
  create(data: CreateProductInput): Promise<Product> {
    return this.db.product.create({ 
      data: {
        name: data.name,
        slug: data.slug,
        basePrice: data.basePrice,
        compareAtPrice: data.compareAtPrice,
        description: data.description,
        shortDescription: data.shortDescription,
        isFeatured: data.isFeatured ?? false,
        isActive: data.isActive ?? true,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
        brand: { connect: { id: data.brandId } },
        category: { connect: { id: data.categoryId } },
      }
    });
  }

  /** Update a product */
  update(id: string, data: UpdateProductInput): Promise<Product> {
    return this.db.product.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        basePrice: data.basePrice,
        compareAtPrice: data.compareAtPrice,
        description: data.description,
        shortDescription: data.shortDescription,
        isFeatured: data.isFeatured,
        isActive: data.isActive,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
        ...(data.brandId ? { brand: { connect: { id: data.brandId } } } : {}),
        ...(data.categoryId ? { category: { connect: { id: data.categoryId } } } : {}),
      }
    });
  }

  /** Delete a product */
  delete(id: string): Promise<Product> {
    return this.db.product.delete({
      where: { id }
    });
  }
}
