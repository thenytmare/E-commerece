import type { Prisma, Product } from '@prisma/client';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@repo/config';
import { BaseRepository } from './base.repository';

const productListInclude = {
  brand: { select: { name: true, slug: true } },
  category: { select: { name: true, slug: true } },
  images: {
    // Prefer the featured image but fall back to the first by sort order.
    // Filtering on isFeatured alone left products that have photos — but none
    // flagged featured — rendering the blank placeholder in every grid.
    take: 1,
    orderBy: [{ isFeatured: 'desc' as const }, { sortOrder: 'asc' as const }],
  },
  variants: {
    where: { isDefault: true },
    take: 1,
    // Inventory comes along so grid cards can show stock status — without it
    // a shopper had to open the product to discover it was sold out.
    select: {
      price: true,
      compareAtPrice: true,
      inventory: { select: { quantity: true, reserved: true } },
    },
  },
} satisfies Prisma.ProductInclude & { brand: object; category: object; images: object; variants: object };

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

/** Columns the admin product table is allowed to sort on. */
export type ProductSortKey = 'name' | 'basePrice' | 'createdAt' | 'updatedAt';

export interface ProductListFilters {
  categoryId?: string;
  brandId?: string;
  isFeatured?: boolean;
  isActive?: boolean;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortKey?: ProductSortKey;
  sortDirection?: 'asc' | 'desc';
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
  costPrice?: number | Prisma.Decimal;
  description?: string | null;
  shortDescription?: string | null;
  isFeatured?: boolean;
  isActive?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export type UpdateProductInput = Partial<CreateProductInput> & { status?: string };

export class ProductRepository extends BaseRepository {
  /** Simple findMany for storefront/dashboard — returns paginated products */
  async findMany(filters?: { isActive?: boolean; isFeatured?: boolean; limit?: number; categoryId?: string; brandId?: string; search?: string; page?: number; }): Promise<PaginatedProducts> {
    const page = Math.max(1, filters?.page ?? 1);
    const limit = Math.min(Math.max(1, filters?.limit ?? DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
    const skip = (page - 1) * limit;
    const where: Prisma.ProductWhereInput = { deletedAt: null };
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.isFeatured !== undefined) where.isFeatured = filters.isFeatured;
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.brandId) where.brandId = filters.brandId;
    if (filters?.search) {
      // Also matches the brand name and short description — searching a brand
      // ("Anker") or a spec word ("noise cancelling") previously returned
      // nothing unless that word happened to be in the product's own name.
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
        { shortDescription: { contains: filters.search, mode: 'insensitive' } },
        { brand: { name: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }
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
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** Best-selling active products by total units sold across all orders. */
  async findBestSelling(limit = 4): Promise<ProductListItem[]> {
    const topSold = await this.db.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit * 2, // headroom in case some top sellers are now inactive/deleted
    });
    if (topSold.length === 0) return [];

    const ids = topSold.map((t) => t.productId);
    const products = await this.db.product.findMany({
      where: { id: { in: ids }, deletedAt: null, isActive: true },
      include: productListInclude,
    });

    const rank = new Map(ids.map((id, i) => [id, i]));
    return products
      .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
      .slice(0, limit);
  }

  /**
   * Full, uncapped {id, name, costPrice, category} projection for dashboard
   * aggregation — unlike findMany(), never clamped to MAX_PAGE_SIZE, so
   * cost/category lookups don't silently go missing for older products.
   */
  findAllForAnalytics() {
    return this.db.product.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        costPrice: true,
        category: { select: { name: true } },
      },
    });
  }

  /** Admin-side lookup — returns a product regardless of its active status. */
  async findBySlug(slug: string): Promise<ProductDetail | null> {
    return this.db.product.findUnique({
      where: { slug, deletedAt: null },
      include: productDetailInclude,
    });
  }

  /**
   * Storefront product lookup.
   *
   * Also requires the product to be active, so switching a product off really
   * does take it off the storefront. Without this, a deactivated (mispriced,
   * recalled, not-yet-launched) product stayed reachable — and buyable — by
   * direct link, and remained indexable by search engines.
   */
  async findPublicBySlug(slug: string): Promise<ProductDetail | null> {
    return this.db.product.findFirst({
      where: { slug, deletedAt: null, isActive: true },
      include: productDetailInclude,
    });
  }

  async findById(id: string, includeDetails?: false): Promise<Product | null>;
  async findById(id: string, includeDetails: true): Promise<ProductDetail | null>;
  async findById(id: string, includeDetails?: boolean): Promise<Product | ProductDetail | null> {
    if (includeDetails) {
      return this.db.product.findUnique({ where: { id }, include: productDetailInclude }) as Promise<ProductDetail | null>;
    }
    return this.db.product.findUnique({ where: { id } });
  }

  async adminFindMany(filters: ProductListFilters = {}): Promise<PaginatedProducts> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(Math.max(1, filters.limit ?? DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
    const skip = (page - 1) * limit;

    // "archived" means soft-deleted — the default deletedAt:null filter
    // must be flipped for that case, otherwise the two conditions can never
    // both be true and the filter returns nothing.
    const where: Prisma.ProductWhereInput =
      filters.status === 'archived' ? { deletedAt: { not: null } } : { deletedAt: null };
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.brandId) where.brandId = filters.brandId;
    if (filters.isFeatured !== undefined) where.isFeatured = filters.isFeatured;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.status && filters.status !== 'archived') where.status = filters.status;

    // Whitelist the sort column so a caller can't inject arbitrary orderBy.
    const allowedSortKeys: ProductSortKey[] = ['name', 'basePrice', 'createdAt', 'updatedAt'];
    const sortKey =
      filters.sortKey && allowedSortKeys.includes(filters.sortKey) ? filters.sortKey : 'createdAt';
    const sortDirection = filters.sortDirection === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      this.db.product.findMany({
        where,
        include: productListInclude,
        orderBy: { [sortKey]: sortDirection },
        skip,
        take: limit,
      }),
      this.db.product.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getStats(): Promise<{ total: number; active: number; draft: number; archived: number; featured: number }> {
    const [total, active, draft, archived, featured] = await Promise.all([
      this.db.product.count({ where: { deletedAt: null } }),
      this.db.product.count({ where: { isActive: true, deletedAt: null } }),
      this.db.product.count({ where: { status: 'draft', deletedAt: null } }),
      this.db.product.count({ where: { deletedAt: { not: null } } }),
      this.db.product.count({ where: { isFeatured: true, deletedAt: null } }),
    ]);
    return { total, active, draft, archived, featured };
  }

  async create(data: CreateProductInput): Promise<Product> {
    return this.db.product.create({ data });
  }

  async update(id: string, data: UpdateProductInput): Promise<Product> {
    return this.db.product.update({ where: { id }, data });
  }

  async duplicate(id: string): Promise<Product> {
    const src = await this.db.product.findUnique({ where: { id }, include: { variants: { include: { inventory: true } }, images: true } });
    if (!src) throw new Error('Product not found');
    return this.db.product.create({
      data: {
        name: `${src.name} (Copy)`,
        slug: `${src.slug}-copy-${Date.now()}`,
        brandId: src.brandId,
        categoryId: src.categoryId,
        description: src.description,
        shortDescription: src.shortDescription,
        basePrice: src.basePrice,
        costPrice: src.costPrice,
        compareAtPrice: src.compareAtPrice,
        status: 'draft',
        isActive: false,
        isFeatured: false,
        variants: { create: src.variants.map((v) => ({ sku: `${v.sku}-COPY`, price: v.price, compareAtPrice: v.compareAtPrice, attributes: v.attributes as Prisma.InputJsonValue, isDefault: v.isDefault, inventory: v.inventory ? { create: { quantity: 0, lowStockThreshold: v.inventory.lowStockThreshold } } : undefined })) },
        images: { create: src.images.map((img, i) => ({ url: img.url, alt: img.alt, sortOrder: i, isFeatured: img.isFeatured })) },
      },
    });
  }

  async softDelete(id: string): Promise<Product> {
    return this.db.product.update({ where: { id }, data: { deletedAt: new Date(), isActive: false, status: 'archived' } });
  }

  async restore(id: string): Promise<Product> {
    // softDelete always zeroes isActive, so a restored product is always
    // 'draft' — safe default, admin re-activates explicitly.
    return this.db.product.update({
      where: { id },
      data: { deletedAt: null, status: 'draft' },
    });
  }

  async delete(id: string): Promise<Product> {
    return this.db.product.delete({ where: { id } });
  }

  async bulkSoftDelete(ids: string[]): Promise<number> {
    const r = await this.db.product.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date(), isActive: false, status: 'archived' } });
    return r.count;
  }

  async bulkRestore(ids: string[]): Promise<number> {
    // Soft-deleted products always have isActive:false (see bulkSoftDelete),
    // so restoring always lands them back in 'draft' — safe default, admin
    // re-activates explicitly rather than products silently going live.
    const r = await this.db.product.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: null, status: 'draft' },
    });
    return r.count;
  }

  async bulkSetActive(ids: string[], isActive: boolean): Promise<number> {
    const r = await this.db.product.updateMany({ where: { id: { in: ids } }, data: { isActive } });
    return r.count;
  }

  async bulkDelete(ids: string[]): Promise<number> {
    const r = await this.db.product.deleteMany({ where: { id: { in: ids } } });
    return r.count;
  }
}