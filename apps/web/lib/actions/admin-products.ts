'use server';

import { createRepositories, prisma } from '@repo/database';
import { slugify, uniqueSlug } from '@repo/utils';
import { requirePermission } from './auth';
import { revalidatePath } from 'next/cache';
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
    hasVariants,
  } = validation.data;

  try {
    // Auto-generate unique slug from product name
    const baseSlug = slugify(name);
    const slug = await uniqueSlug(
      (s) => prisma.product.count({ where: { slug: s } }).then((c) => c > 0),
      baseSlug,
    );

    // Parse image URLs (multiple) and variant assignments
    const imageUrlsJson = formData.get('imageUrls') as string;
    const imageUrls: string[] = imageUrlsJson ? JSON.parse(imageUrlsJson) : [];
    const imageVariantsJson = formData.get('imageVariants') as string;
    const imageVariants: (number | null)[] = imageVariantsJson ? JSON.parse(imageVariantsJson) : [];

    // Parse features (multiple bullet points)
    const featuresJson = formData.get('features') as string;
    const features: string[] = featuresJson ? JSON.parse(featuresJson) : [];

    // Parse variants if enabled
    const variantsJson = formData.get('variants') as string;
    const colorVariants: { name: string; hex: string; price?: number }[] = variantsJson ? JSON.parse(variantsJson) : [];

    // Generate SKU prefix from brand + name
    const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { name: true } });
    const skuPrefix = (brand?.name ?? 'PRD').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);

    // Create the product
    const product = await prisma.product.create({
      data: {
        name,
        slug,
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
    });

    // Create images with variant assignments
    if (imageUrls.length > 0) {
      const variantRecords = hasVariants && colorVariants.length > 0
        ? await prisma.productVariant.findMany({ where: { productId: product.id }, orderBy: { createdAt: 'asc' } })
        : [];
      
      await Promise.all(imageUrls.map((url, i) => {
        const variantIdx = imageVariants[i] ?? null;
        const variantId = variantIdx !== null && variantRecords[variantIdx] ? variantRecords[variantIdx].id : null;
        return prisma.productImage.create({
          data: {
            productId: product.id,
            variantId,
            url,
            alt: name,
            sortOrder: i,
            isFeatured: i === 0,
          },
        });
      }));
    }

    // Create features
    if (features.length > 0) {
      await prisma.productFeature.createMany({
        data: features.map((text, i) => ({
          productId: product.id,
          text,
          sortOrder: i,
        })),
      });
    }

    // Create variants
    if (hasVariants && colorVariants.length > 0) {
      await Promise.all(colorVariants.map((v, i) =>
        prisma.productVariant.create({
          data: {
            productId: product.id,
            sku: `${skuPrefix}-${skuNamePart(name)}-${String(i + 1).padStart(2, '0')}`,
            price: v.price ?? basePrice,
            compareAtPrice: compareAtPrice ?? null,
            attributes: { color: v.name, hex: v.hex },
            isDefault: i === 0,
            inventory: { create: { quantity: 10, lowStockThreshold: 5 } },
          },
        })
      ));
    } else {
      // Auto-create single default variant
      await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: `${skuPrefix}-${skuNamePart(name)}-01`,
          price: basePrice,
          compareAtPrice: compareAtPrice ?? null,
          attributes: { color: 'Default' },
          isDefault: true,
          inventory: { create: { quantity: 10, lowStockThreshold: 5 } },
        },
      });
    }

    // Log audit
    await repos.auditLog.create({
      actorId: session.user.id,
      ipAddress: (await getClientIp()) ?? undefined,
      action: 'product.create',
      entity: 'Product',
      entityId: product.id,
      metadata: { name, basePrice },
    });

    revalidatePath('/admin/catalog/products');
    return { success: true };
  } catch (error) {
    console.error('Failed to create product:', error);
    return { error: 'Failed to create product.' };
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
    hasVariants,
  } = validation.data;

  try {
    // Get current product to detect name changes
    const existing = await repos.product.findById(id);
    const nameChanged = existing && existing.name !== name;

    // Only regenerate slug if name actually changed
    let slug: string | undefined;
    if (nameChanged) {
      const baseSlugValue = slugify(name);
      slug = await uniqueSlug(
        (s) => prisma.product.count({ where: { slug: s, id: { not: id } } }).then((c) => c > 0),
        baseSlugValue,
      );
    }

    await repos.product.update(id, {
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
    });

    // Handle color variants. Must run before image handling below, since
    // image->variant assignments are resolved against the post-edit variant
    // list (see comment there).
    const variantsJson = formData.get('variants') as string | null;

    if (hasVariants && variantsJson) {
      const submittedVariants: { id?: string; name: string; hex: string; price?: number }[] =
        JSON.parse(variantsJson);

      const existingVariants = await prisma.productVariant.findMany({ where: { productId: id } });
      const submittedIds = new Set(submittedVariants.filter((v) => v.id).map((v) => v.id));

      // Update variants that still exist.
      await Promise.all(
        submittedVariants
          .filter((v) => v.id)
          .map((v) =>
            prisma.productVariant.update({
              where: { id: v.id },
              data: {
                attributes: { color: v.name, hex: v.hex },
                price: v.price ?? basePrice,
                compareAtPrice: compareAtPrice ?? null,
              },
            })
          )
      );

      // Create newly-added variants.
      const newVariants = submittedVariants.filter((v) => !v.id);
      if (newVariants.length > 0) {
        const brand = await prisma.brand.findUnique({
          where: { id: brandId },
          select: { name: true },
        });
        const skuPrefix = (brand?.name ?? 'PRD').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
        const namePart = skuNamePart(name);
        let nextIndex = existingVariants.length + 1;
        // If the product had zero variants going in (shouldn't normally
        // happen), make the first newly-created one the default.
        const needsDefault = !existingVariants.some((v) => v.isDefault);
        let defaultAssigned = false;

        await Promise.all(
          newVariants.map((v) => {
            const sku = `${skuPrefix}-${namePart}-${String(nextIndex++).padStart(2, '0')}`;
            const isDefault = needsDefault && !defaultAssigned;
            if (isDefault) defaultAssigned = true;
            return prisma.productVariant.create({
              data: {
                productId: id,
                sku,
                price: v.price ?? basePrice,
                compareAtPrice: compareAtPrice ?? null,
                attributes: { color: v.name, hex: v.hex },
                isDefault,
                inventory: { create: { quantity: 10, lowStockThreshold: 5 } },
              },
            });
          })
        );
      }

      // Variants removed by the admin: only hard-delete ones with no order
      // history, since OrderItem.variant is a required FK (deleting would
      // corrupt past orders). Cart items referencing a removed variant are
      // cleared first so the delete isn't blocked by that FK either.
      const removedVariants = existingVariants.filter((v) => !submittedIds.has(v.id));
      for (const variant of removedVariants) {
        const orderCount = await prisma.orderItem.count({ where: { variantId: variant.id } });
        if (orderCount > 0) continue;
        await prisma.cartItem.deleteMany({ where: { variantId: variant.id } });
        await prisma.wishlistItem.deleteMany({ where: { variantId: variant.id } });
        await prisma.productVariant.delete({ where: { id: variant.id } });
      }
    } else if (!hasVariants) {
      // Simple (non-variant) product: keep its single default variant's
      // price in sync with the Base Price / Compare-at Price fields, since
      // the storefront always reads price from the variant, not the product.
      const defaultVariant = await prisma.productVariant.findFirst({
        where: { productId: id },
        orderBy: { createdAt: 'asc' },
      });
      if (defaultVariant) {
        await prisma.productVariant.update({
          where: { id: defaultVariant.id },
          data: { price: basePrice, compareAtPrice: compareAtPrice ?? null },
        });
      }
    }

    // Handle images (with variant associations)
    const imageUrlsJson = formData.get('imageUrls') as string;
    if (imageUrlsJson) {
      const imageUrls: string[] = JSON.parse(imageUrlsJson);
      const imageVariantsJson = formData.get('imageVariants') as string;
      const imageVariants: (number | null)[] = imageVariantsJson ? JSON.parse(imageVariantsJson) : [];

      // Delete existing images
      await prisma.productImage.deleteMany({ where: { productId: id } });

      if (imageUrls.length > 0) {
        // Fetch variants ordered by creation to map indices -> ids. This must
        // run after the variant create/update/delete step above so removed
        // variants don't shift indices and newly-added ones are included.
        const variantRecords = await prisma.productVariant.findMany({
          where: { productId: id },
          orderBy: { createdAt: 'asc' },
        });

        await Promise.all(imageUrls.map((url, i) => {
          const variantIdx = imageVariants[i] ?? null;
          const variantId = variantIdx !== null && variantRecords[variantIdx] ? variantRecords[variantIdx].id : null;
          return prisma.productImage.create({
            data: {
              productId: id,
              variantId,
              url,
              alt: name,
              sortOrder: i,
              isFeatured: i === 0,
            },
          });
        }));
      }
    }

    // Handle features
    const featuresJson = formData.get('features') as string;
    if (featuresJson) {
      const features: string[] = JSON.parse(featuresJson);
      await prisma.productFeature.deleteMany({ where: { productId: id } });
      if (features.length > 0) {
        await prisma.productFeature.createMany({
          data: features.map((text, i) => ({
            productId: id,
            text,
            sortOrder: i,
          })),
        });
      }
    }

    // Log audit
    await repos.auditLog.create({
      actorId: session.user.id,
      ipAddress: (await getClientIp()) ?? undefined,
      action: 'product.update',
      entity: 'Product',
      entityId: id,
      metadata: { name },
    });

    revalidatePath('/admin/catalog/products');
    revalidatePath(`/admin/catalog/products/${id}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to update product:', error);
    return { error: 'Failed to update product.' };
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
    revalidatePath('/admin/catalog/products');
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
    revalidatePath('/admin/catalog/products');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to restore product.' };
  }
}

export async function toggleProductStatusAction(id: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
  await requirePermission('products.write');
  try {
    await repos.product.update(id, { isActive });
    revalidatePath('/admin/catalog/products');
    return { success: true };
  } catch (error) {
    console.error('Failed to toggle product status:', error);
    return { success: false, error: 'Failed to toggle product status.' };
  }
}

export async function bulkActionProducts(
  ids: string[],
  action: 'soft-delete' | 'restore' | 'activate' | 'deactivate' | 'permanent-delete'
): Promise<{ success: boolean; error?: string; count?: number }> {
  await requirePermission('products.write');
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
        count = await repos.product.bulkSetActive(ids, true);
        break;
      case 'deactivate':
        count = await repos.product.bulkSetActive(ids, false);
        break;
      case 'permanent-delete':
        await requirePermission('products.delete');
        count = await repos.product.bulkDelete(ids);
        break;
    }
    revalidatePath('/admin/catalog/products');
    return { success: true, count };
  } catch {
    return { success: false, error: `Bulk ${action} failed.` };
  }
}