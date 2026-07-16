import type { LowStockInventory, ProductDetail } from '@repo/database';

/** Client-safe product shape used by the product editor. */
export type ProductFormData = {
  id: string;
  name: string;
  slug: string;
  brandId: string;
  categoryId: string;
  description: string | null;
  shortDescription: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  isFeatured: boolean;
  isActive: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
};

export function toProductFormData(product: ProductDetail | null): ProductFormData | null {
  if (!product) return null;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    brandId: product.brandId,
    categoryId: product.categoryId,
    description: product.description,
    shortDescription: product.shortDescription,
    basePrice: Number(product.basePrice),
    compareAtPrice: product.compareAtPrice === null ? null : Number(product.compareAtPrice),
    isFeatured: product.isFeatured,
    isActive: product.isActive,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
  };
}

/** Client-safe row shape for the low-stock dashboard. */
export type InventoryAlertData = {
  id: string;
  quantity: number;
  reserved: number;
  lowStockThreshold: number;
  variant: {
    sku: string;
    product: { name: string };
  };
};

export function toInventoryAlertData(inventory: LowStockInventory[]): InventoryAlertData[] {
  return inventory.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    reserved: item.reserved,
    lowStockThreshold: item.lowStockThreshold,
    variant: {
      sku: item.variant.sku,
      product: { name: item.variant.product.name },
    },
  }));
}
