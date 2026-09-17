import type { LowStockInventory, ProductDetail } from '@repo/database';

/** Client-safe product shape used by the product editor. */
export type ProductFormData = {
  id: string;
  name: string;
  slug: string;
  brandId: string;
  categoryId: string;
  shortDescription: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  costPrice: number;
  isFeatured: boolean;
  isActive: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  featuredImage: string | null;
  images: { url: string; variantIndex: number | null }[];
  features: string[];
  hasVariants: boolean;
  variants: { id: string; name: string; hex: string; price: number }[];
};

export function toProductFormData(product: ProductDetail | null): ProductFormData | null {
  if (!product) return null;

  const featuredImg = product.images.find((img) => img.isFeatured) ?? product.images[0];

  // Must match the createdAt-asc ordering admin-products.ts uses to resolve
  // image -> variant index assignments, so indices line up in both directions.
  const orderedVariants = [...product.variants].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  const variants = orderedVariants.map((v) => {
    const attrs = (v.attributes as Record<string, string>) ?? {};
    return {
      id: v.id,
      name: attrs.color ?? '',
      hex: attrs.hex ?? '#000000',
      price: Number(v.price),
    };
  });

  const hasVariants =
    variants.length > 1 || (variants.length === 1 && variants[0]!.name !== 'Default' && variants[0]!.name !== '');

  const images = [...product.images]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((img) => ({
      url: img.url,
      variantIndex: img.variantId
        ? orderedVariants.findIndex((v) => v.id === img.variantId)
        : null,
    }))
    .map((img) => ({ ...img, variantIndex: img.variantIndex === -1 ? null : img.variantIndex }));

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    brandId: product.brandId,
    categoryId: product.categoryId,
    shortDescription: product.shortDescription,
    basePrice: Number(product.basePrice),
    compareAtPrice: product.compareAtPrice === null ? null : Number(product.compareAtPrice),
    costPrice: Number(product.costPrice),
    isFeatured: product.isFeatured,
    isActive: product.isActive,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    featuredImage: featuredImg?.url ?? null,
    images,
    features: product.features.map((f) => f.text),
    hasVariants,
    variants: hasVariants ? variants : [],
  };
}

/** Client-safe row shape for the low-stock dashboard. */
export type InventoryAlertData = {
  id: string;
  quantity: number;
  reserved: number;
  lowStockThreshold: number;
  variantId: string;
  variant: {
    sku: string;
    productId: string;
    product: { name: string };
  };
};

export function toInventoryAlertData(inventory: LowStockInventory[]): InventoryAlertData[] {
  return inventory.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    reserved: item.reserved,
    lowStockThreshold: item.lowStockThreshold,
    variantId: item.variantId,
    variant: {
      sku: item.variant.sku,
      productId: item.variant.productId,
      product: { name: item.variant.product.name },
    },
  }));
}
