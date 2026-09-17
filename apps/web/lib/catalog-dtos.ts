import type { ProductDetail } from '@repo/database';

/**
 * Client-safe product shape for the product-detail client components.
 *
 * Prisma returns `Decimal` instances for money columns and those are not
 * serialisable across the server/client boundary — React logs "Only plain
 * objects can be passed to Client Components" for every one of them. Convert
 * to plain numbers here so the boundary stays clean.
 */
export type ClientProductVariant = {
  id: string;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  attributes: Record<string, string>;
  isDefault: boolean;
  inventory: { quantity: number; reserved: number } | null;
};

export type ClientProductImage = {
  id: string;
  url: string;
  alt: string | null;
  isFeatured: boolean;
  sortOrder: number;
  variantId: string | null;
};

export type ClientProductDetail = {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  compareAtPrice: number | null;
  brandName: string;
  variants: ClientProductVariant[];
  images: ClientProductImage[];
};

export function toClientProductDetail(product: ProductDetail): ClientProductDetail {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    basePrice: Number(product.basePrice),
    compareAtPrice: product.compareAtPrice === null ? null : Number(product.compareAtPrice),
    brandName: product.brand.name,
    variants: product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      price: Number(v.price),
      compareAtPrice: v.compareAtPrice === null ? null : Number(v.compareAtPrice),
      attributes: (v.attributes as Record<string, string>) ?? {},
      isDefault: v.isDefault,
      inventory: v.inventory
        ? { quantity: v.inventory.quantity, reserved: v.inventory.reserved }
        : null,
    })),
    images: product.images.map((img) => ({
      id: img.id,
      url: img.url,
      alt: img.alt,
      isFeatured: img.isFeatured,
      sortOrder: img.sortOrder,
      variantId: img.variantId,
    })),
  };
}
