'use client';

import React, { useState } from 'react';
import { FormSection } from '@/components/admin/forms/FormSection';
import { FormField } from '@/components/admin/forms/FormField';
import { FormActions } from '@/components/admin/forms/FormActions';
import { ValidationSummary } from '@/components/admin/forms/ValidationSummary';
import { MediaPicker } from '@/components/admin/media/MediaPicker';
import { createProductAction, updateProductAction } from '@/lib/actions/admin-products';
import { Image as ImageIcon, X, GripVertical, Trash, Plus, Star, Palette } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ProductFormData } from '@/lib/admin/catalog-dtos';
import { usePermissions } from '@/lib/hooks/use-permissions';

export function ProductFormClient({
  initialData,
  categories,
  brands,
}: {
  initialData: ProductFormData | null,
  categories: { id: string, name: string }[],
  brands: { id: string, name: string }[]
}) {
  const router = useRouter();
  // The page itself lets a products.read-only viewer open an existing
  // product to look at it (variants/images aren't all visible from the
  // list), but they can't save — the fieldset below keeps every field in
  // the form genuinely inert instead of failing silently on submit.
  const { can } = usePermissions();
  const canWrite = can('products.write');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  // Multi-image gallery: each image can be linked to a variant by index
  type ImageItem = { url: string; variantIndex: number | null };
  const [images, setImages] = useState<ImageItem[]>(() => {
    if (initialData?.images.length) return initialData.images;
    const img = initialData?.featuredImage ?? null;
    return img ? [{ url: img, variantIndex: null }] : [];
  });
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Features (individual bullet points)
  const [features, setFeatures] = useState<string[]>(() => initialData?.features ?? []);

  // Variants toggle
  const [hasVariants, setHasVariants] = useState(() => initialData?.hasVariants ?? false);
  const [colorVariants, setColorVariants] = useState<{ id?: string; name: string; hex: string; price?: number }[]>(
    () =>
      initialData?.hasVariants && initialData.variants.length > 0
        ? initialData.variants
        : [{ name: '', hex: '#000000' }]
  );

  const addImage = (url: string) => {
    if (pickerIndex !== null && pickerIndex < images.length) {
      setImages(prev => prev.map((img, i) => i === pickerIndex ? { ...img, url } : img));
    } else {
      setImages(prev => [...prev, { url, variantIndex: null }]);
    }
    setPickerOpen(false);
    setPickerIndex(null);
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const setImageVariant = (imageIndex: number, variantIndex: number | null) => {
    setImages(prev => prev.map((img, i) => i === imageIndex ? { ...img, variantIndex } : img));
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const newImages = [...images];
    const [dragged] = newImages.splice(dragIndex, 1);
    if (dragged !== undefined) {
      newImages.splice(index, 0, dragged);
      setImages(newImages);
      setDragIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  const addFeature = () => {
    setFeatures(prev => [...prev, '']);
  };

  const updateFeature = (index: number, value: string) => {
    setFeatures(prev => prev.map((f, i) => i === index ? value : f));
  };

  const removeFeature = (index: number) => {
    setFeatures(prev => prev.filter((_, i) => i !== index));
  };

  const handleFeatureKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const input = e.currentTarget;
      const cursorPos = input.selectionStart ?? input.value.length;
      const before = input.value.slice(0, cursorPos);
      const after = input.value.slice(cursorPos);
      setFeatures(prev => prev.map((f, i) => i === index ? before : f));
      setFeatures(prev => {
        const updated = [...prev];
        updated.splice(index + 1, 0, after);
        return updated;
      });
      setTimeout(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>('[data-feature-input]');
        const next = inputs[index + 1];
        if (next) {
          next.focus();
          next.setSelectionRange(0, 0);
        }
      }, 10);
    }
  };

  const addVariant = () => {
    setColorVariants(prev => [...prev, { name: '', hex: '#000000' }]);
  };

  const updateVariant = (index: number, field: 'name' | 'hex' | 'price', value: string) => {
    setColorVariants(prev => prev.map((v, i) => {
      if (i !== index) return v;
      if (field === 'price') return { ...v, price: value ? Number(value) : undefined };
      return { ...v, [field]: value };
    }));
  };

  const removeVariant = (index: number) => {
    setColorVariants(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    formData.append('imageUrls', JSON.stringify(images.map(img => img.url)));
    formData.append('imageVariants', JSON.stringify(images.map(img => img.variantIndex)));
    formData.append('features', JSON.stringify(features.filter(f => f.trim())));
    if (hasVariants) {
      formData.append('variants', JSON.stringify(colorVariants.filter(v => v.name.trim())));
    }

    let res;

    if (initialData) {
      res = await updateProductAction(initialData.id, null, formData);
    } else {
      res = await createProductAction(null, formData);
    }

    if (res.error) {
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
      setIsSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      router.push('/admin/catalog/products');
    }
  };

  const summaryErrors = Object.keys(fieldErrors).length
    ? Object.values(fieldErrors)
    : error
      ? [error]
      : [];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {summaryErrors.length > 0 && <ValidationSummary errors={summaryErrors} />}
      {!canWrite && (
        <div className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          You have read-only access to products — this form is view-only.
        </div>
      )}

      <fieldset disabled={!canWrite} className="space-y-6 border-0 p-0 m-0 min-w-0">
      <FormSection title="Product Gallery" description="Add multiple images. Drag to reorder. First image is featured. Assign images to color variants below.">
        <div className="flex flex-wrap gap-3">
          {images.map((img, i) => (
            <div
              key={i}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDragEnd={handleDragEnd}
              className={`relative group w-24 h-24 rounded-lg overflow-hidden border-2 ${i === 0 ? 'border-primary' : 'border-border'} bg-muted cursor-grab active:cursor-grabbing ${dragIndex === i ? 'opacity-50' : ''}`}
            >
              <img src={img.url} alt={`Product ${i + 1}`} className="w-full h-full object-cover" />
              {i === 0 && (
                <span className="absolute top-0.5 left-0.5 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px]">
                  <Star className="h-3 w-3 fill-current" />
                </span>
              )}
              {/* Variant color dot indicator */}
              {img.variantIndex !== null && colorVariants[img.variantIndex] && (
                <span 
                  className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: colorVariants[img.variantIndex]?.hex }}
                  title={colorVariants[img.variantIndex]?.name || `Variant ${img.variantIndex + 1}`}
                />
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1">
                <button type="button" onClick={() => { setPickerIndex(i); setPickerOpen(true); }} className="p-1 bg-white/90 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" title="Replace">
                  <ImageIcon className="h-3.5 w-3.5 text-foreground" />
                </button>
                <button type="button" onClick={() => removeImage(i)} className="p-1 bg-white/90 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" title="Remove">
                  <Trash className="h-3.5 w-3.5 text-destructive" />
                </button>
                <GripVertical className="h-3.5 w-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity absolute top-0.5 right-0.5" />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => { setPickerIndex(null); setPickerOpen(true); }}
            className="w-24 h-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/20 hover:border-primary hover:bg-muted/40 transition-colors"
          >
            <div className="text-center">
              <ImageIcon className="h-6 w-6 mx-auto text-muted-foreground/50 mb-0.5" />
              <span className="text-[10px] text-muted-foreground">Add Image</span>
            </div>
          </button>
        </div>

        {/* Variant image assignment — dropdown per image */}
        {hasVariants && images.length > 0 && (
          <div className="mt-4 p-3 border border-border rounded-lg bg-muted/10">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <Palette className="h-3.5 w-3.5" /> Assign Images to Variants
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {images.map((img, i) => (
                <div key={i} className="flex items-center gap-2">
                  <img src={img.url} alt="" className="w-8 h-8 rounded object-cover" />
                  <select
                    value={img.variantIndex ?? ''}
                    onChange={(e) => setImageVariant(i, e.target.value ? Number(e.target.value) : null)}
                    className="flex-1 bg-background border border-border rounded-md px-2 py-1 text-xs"
                  >
                    <option value="">General</option>
                    {colorVariants.map((v, vi) => (
                      <option key={vi} value={vi}>
                        {v.name || `Color ${vi + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </FormSection>

      <FormSection title="Basic Details" description="Core information about the product.">
        <div className="grid gap-6">
          <FormField id="name" label="Product Name" required>
            <input
              type="text"
              id="name"
              name="name"
              defaultValue={initialData?.name || ''}
              required
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField id="categoryId" label="Category" required>
              <select
                id="categoryId"
                name="categoryId"
                defaultValue={initialData?.categoryId || ''}
                required
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
              >
                <option value="" disabled>Select Category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FormField>

            <FormField id="brandId" label="Brand" required>
              <select
                id="brandId"
                name="brandId"
                defaultValue={initialData?.brandId || ''}
                required
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
              >
                <option value="" disabled>Select Brand</option>
                {brands.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </FormField>
          </div>
        </div>
      </FormSection>

      <FormSection title="Pricing" description="Set your product pricing strategy.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField id="basePrice" label="Base Price (KES)" required>
            <input
              type="number"
              step="0.01"
              id="basePrice"
              name="basePrice"
              defaultValue={initialData?.basePrice ?? ''}
              required
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            />
          </FormField>

          <FormField id="compareAtPrice" label="Compare at Price (KES)" description="Original price for showing discounts.">
            <input
              type="number"
              step="0.01"
              id="compareAtPrice"
              name="compareAtPrice"
              defaultValue={initialData?.compareAtPrice ?? ''}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            />
          </FormField>

          <FormField id="costPrice" label="Cost Price (KES)" description="What you pay for this product. Used for profit reporting — never shown to customers.">
            <input
              type="number"
              step="0.01"
              id="costPrice"
              name="costPrice"
              defaultValue={initialData?.costPrice ?? ''}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Short Description" description="A brief summary shown under the product name.">
        <textarea
          id="shortDescription"
          name="shortDescription"
          defaultValue={initialData?.shortDescription || ''}
          rows={2}
          className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors resize-y"
        />
      </FormSection>

      <FormSection title="Key Features" description="Bullet-point features shown on the product page.">
        <div className="space-y-2">
          {features.map((feature, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-4">•</span>
              <input
                type="text"
                value={feature}
                data-feature-input
                onChange={(e) => updateFeature(i, e.target.value)}
                onKeyDown={(e) => handleFeatureKeyDown(i, e)}
                placeholder="e.g., Adaptive ANC 2.0"
                className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
              />
              <button type="button" onClick={() => removeFeature(i)} className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={addFeature} className="flex items-center gap-1.5 text-sm text-primary hover:underline mt-1">
            <Plus className="h-4 w-4" /> Add Feature
          </button>
        </div>
      </FormSection>

      <FormSection title="Color Variants" description="Enable if this product comes in multiple colors.">
        <label className="flex items-center gap-3 mb-4">
          <input
            type="checkbox"
            name="hasVariants"
            checked={hasVariants}
            onChange={(e) => setHasVariants(e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-sm font-medium text-foreground">This product has color variants</span>
        </label>

        {hasVariants && (
          <div className="space-y-3 border border-border rounded-lg p-4">
            {colorVariants.map((v, i) => (
              <div key={i} className="flex items-center gap-3">
                <input
                  type="color"
                  value={v.hex}
                  onChange={(e) => updateVariant(i, 'hex', e.target.value)}
                  className="w-8 h-8 rounded border border-border cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={v.name}
                  onChange={(e) => updateVariant(i, 'name', e.target.value)}
                  placeholder="Color name (e.g., Midnight Black)"
                  className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                />
                <input
                  type="number"
                  step="0.01"
                  value={v.price ?? ''}
                  onChange={(e) => updateVariant(i, 'price', e.target.value)}
                  placeholder="Price (optional)"
                  className="w-28 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                />
                {colorVariants.length > 1 && (
                  <button type="button" onClick={() => removeVariant(i)} className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-muted">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addVariant} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
              <Plus className="h-4 w-4" /> Add Color
            </button>
          </div>
        )}
      </FormSection>

      <FormSection title="SEO" description="Search engine optimization fields (optional).">
        <div className="grid gap-4">
          <FormField id="seoTitle" label="Meta Title" description="Appears in browser tabs and search results.">
            <input
              type="text"
              id="seoTitle"
              name="seoTitle"
              defaultValue={initialData?.seoTitle || ''}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            />
          </FormField>
          <FormField id="seoDescription" label="Meta Description" description="Shown under the title in search results (max 160 characters).">
            <textarea
              id="seoDescription"
              name="seoDescription"
              defaultValue={initialData?.seoDescription || ''}
              rows={2}
              maxLength={160}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors resize-y"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Status & Visibility" description="Control how and when this product appears.">
        <div className="flex flex-col gap-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={initialData ? initialData.isActive : true}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium text-foreground">Active (visible on storefront)</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="isFeatured"
              defaultChecked={initialData ? initialData.isFeatured : false}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium text-foreground">Featured (show on homepage)</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="showOutOfStock"
              defaultChecked={true}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium text-foreground">Show on storefront even when out of stock</span>
          </label>
        </div>
        {initialData && (
          <div className="mt-3 pt-3 border-t border-border">
            <a
              href={`/products/${initialData.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              Preview product on storefront →
            </a>
          </div>
        )}
      </FormSection>

      </fieldset>

      <FormActions
        isSubmitting={isSubmitting}
        submitDisabled={!canWrite}
        onCancel={() => router.push('/admin/catalog/products')}
        submitText={initialData ? 'Update Product' : 'Create Product'}
      />

      <MediaPicker
        isOpen={pickerOpen}
        onClose={() => { setPickerOpen(false); setPickerIndex(null); }}
        onSelect={(url) => addImage(url)}
      />
    </form>
  );
}