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
    const page = Number.isSafeInteger(filters?.page) ? Math.min(10_000, Math.max(1, filters!.page!)) : 1;
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
    const page = Number.isSafeInteger(filters.page) ? Math.min(10_000, Math.max(1, filters.page!)) : 1;
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

  /**
   * Save a product and its variants, images and features as ONE transaction.
   *
   * The caller has already validated every part of the payload. If any write
   * fails here (a duplicate SKU, a foreign variant, a database error) the whole
   * save rolls back and the product stays exactly as it was.
   *
   * `variants: undefined` means "leave variants alone". Same for images and
   * features. New variants get the opening stock the admin typed, default 0.
   */
  async updateAggregate(
    id: string,
    input: {
      product: UpdateProductInput;
      basePrice: number;
      compareAtPrice: number | null;
      hasVariants: boolean;
      brandId: string;
      name: string;
      variants?: { id?: string; name: string; hex: string; price?: number; stock?: number; expectedStock?: number }[];
      stock?: number;
      expectedStock?: number;
      actorId?: string;
      images?: { urls: string[]; variantIndexes: (number | null)[] };
      features?: string[];
    }
  ): Promise<void> {
    const { product, basePrice, compareAtPrice, hasVariants, brandId, name } = input;

    await this.db.$transaction(
      async (tx) => {
        await tx.product.update({ where: { id }, data: product });

        const existingVariants = await tx.productVariant.findMany({ where: { productId: id } });
        const setStock = async (variantId: string, stock: number, expected: number | undefined) => {
          if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000 || !Number.isInteger(expected) || expected! < 0) {
            throw new Error('Stock requires a valid quantity and previous quantity. Reload the product.');
          }
          if (stock === expected) return;
          // Compare-and-set prevents a stale form from overwriting a sale or restock.
          const result = await tx.inventory.updateMany({
            where: { variantId, quantity: expected, reserved: { lte: stock } }, data: { quantity: stock },
          });
          if (result.count !== 1) throw new Error('Stock changed or the quantity is below reserved units. Reload the product and try again.');
          await tx.inventoryLog.create({ data: { variantId, change: stock - expected!, reason: 'admin_product_edit', referenceId: input.actorId } });
        };

        if (hasVariants && input.variants) {
          const submitted = input.variants;
          const ownedIds = new Set(existingVariants.map((v) => v.id));

          // A variant id must belong to THIS product. Without this check an
          // admin request could rewrite a variant of a different product.
          for (const v of submitted) {
            if (v.id && !ownedIds.has(v.id)) {
              throw new Error('A variant does not belong to this product');
            }
          }

          for (const v of submitted.filter((x) => x.id)) {
            if (v.stock !== undefined) await setStock(v.id!, v.stock, v.expectedStock);
            await tx.productVariant.update({
              where: { id: v.id! },
              data: {
                attributes: { color: v.name, hex: v.hex },
                price: v.price ?? basePrice,
                compareAtPrice,
              },
            });
          }

          const newVariants = submitted.filter((x) => !x.id);
          if (newVariants.length > 0) {
            const brand = await tx.brand.findUnique({ where: { id: brandId }, select: { name: true } });
            const skuPrefix = (brand?.name ?? 'PRD').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
            const namePart = name.replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase();
            const usedSkus = new Set(existingVariants.map((v) => v.sku));
            let nextIndex = existingVariants.length + 1;
            let defaultNeeded = !existingVariants.some((v) => v.isDefault);

            for (const v of newVariants) {
              // Never reuse a SKU, even after variants were deleted earlier.
              let sku = `${skuPrefix}-${namePart}-${String(nextIndex++).padStart(2, '0')}`;
              while (usedSkus.has(sku)) {
                sku = `${skuPrefix}-${namePart}-${String(nextIndex++).padStart(2, '0')}`;
              }
              usedSkus.add(sku);

              await tx.productVariant.create({
                data: {
                  productId: id,
                  sku,
                  price: v.price ?? basePrice,
                  compareAtPrice,
                  attributes: { color: v.name, hex: v.hex },
                  isDefault: defaultNeeded,
                  inventory: { create: { quantity: v.stock ?? 0, lowStockThreshold: 5 } },
                },
              });
              defaultNeeded = false;
            }
          }

          // Variants removed by the admin. Ones with order history are kept,
          // because order items point at them.
          const keepIds = new Set(submitted.filter((x) => x.id).map((x) => x.id!));
          for (const variant of existingVariants.filter((v) => !keepIds.has(v.id))) {
            const orderCount = await tx.orderItem.count({ where: { variantId: variant.id } });
            if (orderCount > 0) continue;
            await tx.cartItem.deleteMany({ where: { variantId: variant.id } });
            await tx.wishlistItem.deleteMany({ where: { variantId: variant.id } });
            await tx.productVariant.delete({ where: { id: variant.id } });
          }
        } else if (!hasVariants) {
          // Simple product: keep its single variant's price in step.
          const defaultVariant = [...existingVariants].sort(
            (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
          )[0];
          if (defaultVariant) {
            if (input.stock !== undefined) await setStock(defaultVariant.id, input.stock, input.expectedStock);
            await tx.productVariant.update({
              where: { id: defaultVariant.id },
              data: { price: basePrice, compareAtPrice },
            });
          }
        }

        if (input.images) {
          await tx.productImage.deleteMany({ where: { productId: id } });
          if (input.images.urls.length > 0) {
            // Read after the variant changes above, so indexes match.
            const records = await tx.productVariant.findMany({
              where: { productId: id },
              orderBy: { createdAt: 'asc' },
            });
            for (const [i, url] of input.images.urls.entries()) {
              const idx = input.images.variantIndexes[i] ?? null;
              await tx.productImage.create({
                data: {
                  productId: id,
                  variantId: idx !== null && records[idx] ? records[idx].id : null,
                  url,
                  alt: name,
                  sortOrder: i,
                  isFeatured: i === 0,
                },
              });
            }
          }
        }

        if (input.features) {
          await tx.productFeature.deleteMany({ where: { productId: id } });
          if (input.features.length > 0) {
            await tx.productFeature.createMany({
              data: input.features.map((text, i) => ({ productId: id, text, sortOrder: i })),
            });
          }
        }
      },
      { maxWait: 10_000, timeout: 20_000 }
    );
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

  /**
   * Show or hide products on the storefront. Hidden products keep all their
   * data, stock, images and order history. They just stop appearing to customers.
   *
   * Sets `isActive` and `status` together, so the two never disagree
   * (`updateProductAction` keeps them in step the same way). Deleted products
   * are skipped: hiding is not a way to bring a trashed product back.
   * One conditional statement, so no read-then-write gap. Returns the number
   * of products that were actually updated.
   */
  async bulkSetActive(ids: string[], isActive: boolean): Promise<number> {
    if (ids.length === 0) return 0;
    const r = await this.db.product.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { isActive, status: isActive ? 'active' : 'draft' },
    });
    return r.count;
  }

  /** Show or hide one product. Returns false when it is missing or deleted. */
  async setVisibility(id: string, isActive: boolean): Promise<boolean> {
    return (await this.bulkSetActive([id], isActive)) === 1;
  }

  /**
   * Counts for the All / Visible / Hidden tabs. They respect the search, brand,
   * category and featured filters, but never the visibility filter itself, so
   * each tab shows how many products it would list.
   */
  async getVisibilityCounts(
    filters: { search?: string; brandId?: string; categoryId?: string; isFeatured?: boolean } = {}
  ): Promise<{ all: number; visible: number; hidden: number }> {
    const where: Prisma.ProductWhereInput = { deletedAt: null };
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.brandId) where.brandId = filters.brandId;
    if (filters.isFeatured !== undefined) where.isFeatured = filters.isFeatured;

    const [visible, hidden] = await Promise.all([
      this.db.product.count({ where: { ...where, isActive: true } }),
      this.db.product.count({ where: { ...where, isActive: false } }),
    ]);
    return { all: visible + hidden, visible, hidden };
  }

  /**
   * Units available to buy (on hand minus reserved) for each product, summed
   * over all its variants. For the admin list's stock column. Products with no
   * stock row are returned as 0.
   */
  async getAvailableStockByProduct(productIds: string[]): Promise<Map<string, number>> {
    const totals = new Map<string, number>(productIds.map((id) => [id, 0]));
    if (productIds.length === 0) return totals;
    const rows = await this.db.inventory.findMany({
      where: { variant: { productId: { in: productIds } } },
      select: { quantity: true, reserved: true, variant: { select: { productId: true } } },
    });
    for (const row of rows) {
      const id = row.variant.productId;
      totals.set(id, (totals.get(id) ?? 0) + Math.max(0, row.quantity - row.reserved));
    }
    return totals;
  }

  async bulkDelete(ids: string[]): Promise<number> {
    const r = await this.db.product.deleteMany({ where: { id: { in: ids } } });
    return r.count;
  }
}
