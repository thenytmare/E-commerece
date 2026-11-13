'use server';

import { createRepositories, prisma } from '@repo/database';
import { slugify, uniqueSlug } from '@repo/utils';
import { requirePermission } from './auth';
import { revalidatePath, revalidateTag } from 'next/cache';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  parseFeaturesJson,
  parseImageUrlsJson,
  parseImageVariantsJson,
  parseVariantsJson,
} from '@repo/config';
import { parseFormData, productSchema } from '@/lib/validations/admin';
import { getClientIp } from '@/lib/request-context';

const repos = createRepositories();

/**
 * Name fragment used when auto-generating a SKU.
 *
 * The `i` flag matters: without it the character class strips every lowercase
 * letter *before* the string is upper-cased, so "Wireless Mouse" became "WM"
 * and an all-lowercase name became empty — producing malformed SKUs and
 * collisions on the unique constraint between unrelated products.
 */
function skuNamePart(name: string): string {
  return name.replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase();
}


export type ActionState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function createProductAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const session = await requirePermission('products.write');
  const validation = parseFormData(productSchema, formData);
  if (validation.fieldErrors) return { error: 'Please correct the highlighted fields.', fieldErrors: validation.fieldErrors };
  const { name, brandId, categoryId, basePrice, compareAtPrice, costPrice, shortDescription, seoTitle, seoDescription, isActive, isFeatured, hasVariants, stock } = validation.data;
  const variants = parseVariantsJson(formData.get('variants') as string | null);
  const images = parseImageUrlsJson(formData.get('imageUrls') as string | null);
  const assignments = parseImageVariantsJson(formData.get('imageVariants') as string | null);
  const features = parseFeaturesJson(formData.get('features') as string | null);
  if (!variants.ok) return { error: variants.error };
  if (!images.ok) return { error: images.error };
  if (!assignments.ok) return { error: assignments.error };
  if (!features.ok) return { error: features.error };
  if (hasVariants && !variants.value?.length) return { error: 'Add at least one color variant.' };
  if (compareAtPrice !== null && compareAtPrice !== undefined && compareAtPrice < 0) return { error: 'Compare-at price cannot be negative.' };
  if ((stock ?? 0) > 0 || variants.value?.some(v => (v.stock ?? 0) > 0)) await requirePermission('inventory.write');
  try {
    const slug = await uniqueSlug(s => prisma.product.count({ where: { slug: s } }).then(c => c > 0), slugify(name));
    await prisma.$transaction(async tx => {
      const brand = await tx.brand.findUnique({ where: { id: brandId }, select: { name: true } });
      const prefix = (brand?.name ?? 'PRD').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
      const created = await tx.product.create({ data: {
        name, slug, brandId, categoryId, basePrice, compareAtPrice: compareAtPrice ?? null, costPrice,
        shortDescription: shortDescription ?? null, isFeatured, isActive, status: isActive ? 'active' : 'draft',
        seoTitle: seoTitle ?? null, seoDescription: seoDescription ?? null,
      } });
      const inputs = hasVariants ? variants.value! : [{ name: 'Default', hex: '#000000', stock: stock ?? 0 }];
      const variantIds: string[] = [];
      for (const [i, v] of inputs.entries()) {
        const variant = await tx.productVariant.create({ data: {
          productId: created.id, sku: `${prefix}-${skuNamePart(name)}-${created.id}-${i + 1}`,
          price: v.price ?? basePrice, compareAtPrice: compareAtPrice ?? null,
          attributes: { color: v.name, hex: v.hex }, isDefault: i === 0,
          inventory: { create: { quantity: v.stock ?? 0, lowStockThreshold: 5 } },
        } });
        variantIds.push(variant.id);
        if (v.stock) await tx.inventoryLog.create({ data: { variantId: variant.id, change: v.stock, reason: 'opening_stock', referenceId: session.user.id } });
      }
      for (const [i, url] of (images.value ?? []).entries()) {
        const idx = assignments.value[i];
        await tx.productImage.create({ data: { productId: created.id, url, alt: name, sortOrder: i, isFeatured: i === 0, variantId: idx == null ? null : variantIds[idx] ?? null } });
      }
      if (features.value?.length) await tx.productFeature.createMany({ data: features.value.map((text, i) => ({ productId: created.id, text, sortOrder: i })) });
      await tx.auditLog.create({ data: { actorId: session.user.id, action: 'product.create', entity: 'Product', entityId: created.id, metadata: { name, basePrice } } });
    }, { maxWait: 10_000, timeout: 20_000 });
    revalidatePath('/admin/catalog/products'); revalidatePath('/admin/inventory'); revalidateTag('catalog');
    return { success: true };
  } catch (error) {
    console.error('Failed to create product:', error);
    return { error: 'Failed to create product. Nothing was saved.' };
  }
}
export async function updateProductAction(
  id: string,
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const session = await requirePermission('products.write');

  const validation = parseFormData(productSchema, formData);
  if (validation.fieldErrors) {
    return { error: 'Please correct the highlighted fields.', fieldErrors: validation.fieldErrors };
  }
  const {
    name,
    brandId,
    categoryId,
    basePrice,
    compareAtPrice,
    costPrice,
    shortDescription,
    seoTitle,
    seoDescription,
    isActive,
    isFeatured,
    hasVariants, stock, expectedStock,
  } = validation.data;

  // Check every nested part of the payload BEFORE writing anything.
  const variants = parseVariantsJson(formData.get('variants') as string | null);
  if (!variants.ok) return { error: variants.error };
  const imageUrls = parseImageUrlsJson(formData.get('imageUrls') as string | null);
  if (!imageUrls.ok) return { error: imageUrls.error };
  const imageVariants = parseImageVariantsJson(formData.get('imageVariants') as string | null);
  if (!imageVariants.ok) return { error: imageVariants.error };
  const features = parseFeaturesJson(formData.get('features') as string | null);
  if (!features.ok) return { error: features.error };

  if (hasVariants && !variants.value?.length) return { error: 'Add at least one color variant.' };
  if (stock !== null || variants.value?.some(v => v.stock !== undefined)) await requirePermission('inventory.write');
  if (variants.value?.some(v => v.id && v.stock !== undefined && v.expectedStock === undefined)) return { error: 'Stock requires the previous quantity. Reload the product.' };
  if (stock !== null && expectedStock === null) return { error: 'Stock requires the previous quantity. Reload the product.' };
  // Variant prices follow the same rules as the base price.
  if (compareAtPrice !== undefined && compareAtPrice !== null && compareAtPrice < 0) {
    return { error: 'Compare-at price cannot be negative.' };
  }

  try {
    // Get current product to detect name changes
    const existing = await repos.product.findById(id);
    if (!existing) return { error: 'Product not found.' };
    const nameChanged = existing.name !== name;

    // Only regenerate slug if name actually changed
    let slug: string | undefined;
    if (nameChanged) {
      const baseSlugValue = slugify(name);
      slug = await uniqueSlug(
        (s) => prisma.product.count({ where: { slug: s, id: { not: id } } }).then((c) => c > 0),
        baseSlugValue,
      );
    }

    // One transaction: if anything fails, the product is left as it was.
    await repos.product.updateAggregate(id, {
      product: {
        name,
        ...(slug ? { slug } : {}),
        brandId,
        categoryId,
        basePrice,
        compareAtPrice: compareAtPrice ?? null,
        costPrice,
        shortDescription: shortDescription ?? null,
        isFeatured,
        isActive,
        status: isActive ? 'active' : 'draft',
        seoTitle: seoTitle ?? null,
        seoDescription: seoDescription ?? null,
      },
      basePrice,
      compareAtPrice: compareAtPrice ?? null,
      hasVariants,
      brandId,
      name,
      variants: variants.value,
      stock: stock ?? undefined, expectedStock: expectedStock ?? undefined, actorId: session.user.id,
      images: imageUrls.value
        ? { urls: imageUrls.value, variantIndexes: imageVariants.value }
        : undefined,
      features: features.value,
    });

    // Log audit
    await repos.auditLog.create({
      actorId: session.user.id,
      ipAddress: (await getClientIp()) ?? undefined,
      action: 'product.update',
      entity: 'Product',
      entityId: id,
      metadata: { name },
    });

    revalidatePath('/admin/catalog/products'); revalidateTag('catalog');
    revalidatePath('/admin/inventory');
    revalidatePath(`/admin/catalog/products/${id}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to update product:', error);
    if (error instanceof Error && (error.message.includes('does not belong') || error.message.startsWith('Stock'))) {
      return { error: error.message };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { error: 'A SKU or slug already exists. Nothing was saved.' };
    }
    return { error: 'Failed to update product. Nothing was saved.' };
  }
}

export async function deleteProductAction(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await requirePermission('products.delete');
  try {
    const product = await repos.product.findById(id);
    await repos.product.softDelete(id);
    await repos.auditLog.create({
      actorId: session.user.id,
      ipAddress: (await getClientIp()) ?? undefined,
      action: 'product.delete',
      entity: 'Product',
      entityId: id,
      metadata: { name: product?.name ?? 'Unknown' },
    });
    revalidatePath('/admin/catalog/products'); revalidateTag('catalog');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete product:', error);
    return { success: false, error: 'Failed to delete product.' };
  }
}

export async function restoreProductAction(id: string): Promise<{ success: boolean; error?: string }> {
  await requirePermission('products.write');
  try {
    await repos.product.restore(id);
    revalidatePath('/admin/catalog/products'); revalidateTag('catalog');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to restore product.' };
  }
}

export type VisibilityResult = { success: boolean; changed?: number; error?: string };

const MAX_BULK_VISIBILITY = 200;
const visibilityInputSchema = z.object({
  ids: z.array(z.string().trim().min(1).max(64)).min(1).max(MAX_BULK_VISIBILITY),
  isActive: z.boolean(),
});

/**
 * Show or hide products on the storefront. Shared by the single toggle, the
 * bulk buttons and the old bulk "activate" and "deactivate" actions, so every
 * path validates, writes, logs and refreshes the same way.
 */
async function applyProductVisibility(
  session: { user: { id: string } },
  ids: string[],
  isActive: boolean
): Promise<VisibilityResult> {
  const parsed = visibilityInputSchema.safeParse({ ids: [...new Set(ids)], isActive });
  if (!parsed.success) {
    return {
      success: false,
      error: ids.length > MAX_BULK_VISIBILITY
        ? `Choose at most ${MAX_BULK_VISIBILITY} products at a time.`
        : 'Invalid request.',
    };
  }

  try {
    const changed = await repos.product.bulkSetActive(parsed.data.ids, parsed.data.isActive);
    if (changed === 0) {
      return { success: false, changed: 0, error: 'That product is missing or in the Trash.' };
    }

    await repos.auditLog.create({
      actorId: session.user.id,
      ipAddress: (await getClientIp()) ?? undefined,
      action: 'product.visibility_change',
      entity: 'Product',
      entityId: parsed.data.ids.length === 1 ? parsed.data.ids[0]! : 'bulk',
      metadata: { ids: parsed.data.ids, isActive: parsed.data.isActive, changed },
    });

    // Refresh cached storefront data and the admin list so the change shows soon.
    revalidateTag('catalog');
    revalidatePath('/admin/catalog/products');
    revalidatePath('/');
    revalidatePath('/products');
    return { success: true, changed };
  } catch (error) {
    console.error('Failed to change product visibility:', error);
    return { success: false, error: 'Could not change visibility. Nothing was changed.' };
  }
}

/** Show (true) or hide (false) one product on the storefront. */
export async function setProductVisibilityAction(
  productId: string,
  isActive: boolean
): Promise<VisibilityResult> {
  const session = await requirePermission('products.write');
  return applyProductVisibility(session, [productId], isActive);
}

/** Show or hide up to 200 products at once. */
export async function bulkSetProductVisibilityAction(
  ids: string[],
  isActive: boolean
): Promise<VisibilityResult> {
  const session = await requirePermission('products.write');
  return applyProductVisibility(session, ids, isActive);
}

/** Kept for older callers. Same behaviour as setProductVisibilityAction. */
export async function toggleProductStatusAction(
  id: string,
  isActive: boolean
): Promise<VisibilityResult> {
  return setProductVisibilityAction(id, isActive);
}

export async function bulkActionProducts(
  ids: string[],
  action: 'soft-delete' | 'restore' | 'activate' | 'deactivate' | 'permanent-delete'
): Promise<{ success: boolean; error?: string; count?: number }> {
  const session = await requirePermission('products.write');
  try {
    let count = 0;
    switch (action) {
      case 'soft-delete':
        await requirePermission('products.delete');
        count = await repos.product.bulkSoftDelete(ids);
        break;
      case 'restore':
        count = await repos.product.bulkRestore(ids);
        break;
      case 'activate':
      case 'deactivate': {
        const visibility = await applyProductVisibility(session, ids, action === 'activate');
        if (!visibility.success) return { success: false, error: visibility.error };
        return { success: true, count: visibility.changed };
      }
      case 'permanent-delete':
        await requirePermission('products.delete');
        count = await repos.product.bulkDelete(ids);
        break;
    }
    revalidatePath('/admin/catalog/products'); revalidateTag('catalog');
    return { success: true, count };
  } catch {
    return { success: false, error: `Bulk ${action} failed.` };
  }
}