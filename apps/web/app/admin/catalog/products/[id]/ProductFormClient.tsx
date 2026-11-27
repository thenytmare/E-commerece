'use client';

import React, { useRef, useState } from 'react';
import { FormSection } from '@/components/admin/forms/FormSection';
import { FormField } from '@/components/admin/forms/FormField';
import { FormActions } from '@/components/admin/forms/FormActions';
import { ValidationSummary } from '@/components/admin/forms/ValidationSummary';
import { MediaPicker } from '@/components/admin/media/MediaPicker';
import { shrinkImage } from '@/components/admin/media/compress-image';
import { createProductAction, updateProductAction } from '@/lib/actions/admin-products';
import { Image as ImageIcon, X, ChevronLeft, ChevronRight, Trash, Plus, Star, Palette, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ProductFormData } from '@/lib/admin/catalog-dtos';
import { usePermissions } from '@/lib/hooks/use-permissions';

export function ProductFormClient({
  initialData,
  categories,
  brands,
  listHref = '/admin/catalog/products',
}: {
  initialData: ProductFormData | null,
  categories: { id: string, name: string }[],
  brands: { id: string, name: string }[],
  /** The products list as the admin left it, with filters and page. */
  listHref?: string
}) {
  const router = useRouter();
  // The page itself lets a products.read-only viewer open an existing
  // product to look at it (variants/images aren't all visible from the
  // list), but they can't save — the fieldset below keeps every field in
  // the form genuinely inert instead of failing silently on submit.
  const { can } = usePermissions();
  const canWrite = can('products.write');
  const canEditStock = can('inventory.write');
  const canUpload = can('media.write');

  // Photos sent straight from this device (gallery or camera) to this product.
  // They are still saved in the media library, but no folder or category has
  // to be chosen first: they take this product's category.
  const deviceFileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || '');
  const [stock, setStock] = useState(String(initialData?.stock ?? 0));
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
  const [colorVariants, setColorVariants] = useState<{ id?: string; name: string; hex: string; price?: number; stock?: number; reserved?: number }[]>(
    () =>
      initialData?.variants.length
        ? initialData.variants.map(v => ({ ...v, name: initialData.hasVariants ? v.name : '' }))
        : [{ name: '', hex: '#000000', stock: 0 }]
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

  const uploadFromDevice = async (files: FileList | null) => {
    const chosen = Array.from(files ?? []).filter(file => file.type.startsWith('image/'));
    if (chosen.length === 0) {
      setUploadMessage('Choose image files.');
      return;
    }
    setUploading(true);
    setUploadMessage(null);
    const problems: string[] = [];
    for (const original of chosen) {
      try {
        const body = new FormData();
        body.append('file', await shrinkImage(original));
        if (categoryId) body.append('categoryId', categoryId);
        const res = await fetch('/api/admin/media/upload', { method: 'POST', body });
        const data = await res.json();
        if (!res.ok || !data?.media?.url) throw new Error(data?.error || 'Upload failed.');
        setImages(prev => [...prev, { url: data.media.url as string, variantIndex: null }]);
      } catch (err) {
        problems.push(`${original.name}: ${err instanceof Error ? err.message : 'Upload failed.'}`);
      }
    }
    setUploading(false);
    setUploadMessage(problems.length ? problems.join(' ') : null);
  };

  // Moves one image to a new place. The first place is the main photo.
  const moveImage = (from: number, to: number) => {
    setImages(prev => {
      if (to < 0 || to >= prev.length || from === to) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      if (item === undefined) return prev;
      next.splice(to, 0, item);
      return next;
    });
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
    setColorVariants(prev => [...prev, { name: '', hex: '#000000', stock: 0 }]);
  };

  const updateVariant = (index: number, field: 'name' | 'hex' | 'price' | 'stock', value: string) => {
    setColorVariants(prev => prev.map((v, i) => {
      if (i !== index) return v;
      if (field === 'price') return { ...v, price: value ? Number(value) : undefined };
      if (field === 'stock') return { ...v, stock: value === '' ? undefined : Number(value) };
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
      formData.append('variants', JSON.stringify(colorVariants.map(v => {
        const previous = initialData?.variants.find(old => old.id === v.id);
        const { stock: quantity, ...details } = v;
        return { ...details, ...(canEditStock && (!previous || quantity !== previous.stock) ? { stock: quantity, expectedStock: previous?.stock } : {}) };
      })));
    } else if (canEditStock && (!initialData || Number(stock) !== initialData.stock)) {
      formData.set('stock', stock);
      if (initialData) formData.set('expectedStock', String(initialData.stock));
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
      router.push(listHref);
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
      <FormSection title="Product Gallery" description="Upload photos straight from your phone or computer, or pick ones already in the library. On a computer, drag to reorder. On a phone, use the arrow buttons under each image. The first image is the main one. Assign images to color variants below.">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          {images.map((img, i) => (
            <div key={i} className="sm:w-28">
              {/* Dragging works on a computer. On a phone, use the buttons underneath. */}
              <div
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragEnd={handleDragEnd}
                className={`relative aspect-square overflow-hidden rounded-lg border-2 ${i === 0 ? 'border-primary' : 'border-border'} bg-muted sm:cursor-grab sm:active:cursor-grabbing ${dragIndex === i ? 'opacity-50' : ''}`}
              >
                <img src={img.url} alt={`Product ${i + 1}`} className="h-full w-full object-cover" />
                {i === 0 && (
                  <span className="absolute left-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    <Star className="h-3 w-3 fill-current" />
                  </span>
                )}
                {/* Variant color dot indicator */}
                {img.variantIndex !== null && colorVariants[img.variantIndex] && (
                  <span
                    className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: colorVariants[img.variantIndex]?.hex }}
                    title={colorVariants[img.variantIndex]?.name || `Variant ${img.variantIndex + 1}`}
                  />
                )}
              </div>
              <div className="mt-1 flex items-center gap-1">
                <button type="button" onClick={() => moveImage(i, i - 1)} disabled={i === 0} aria-label={`Move image ${i + 1} earlier`} className="inline-flex h-11 min-w-0 flex-1 items-center justify-center rounded-md border border-border disabled:opacity-30 sm:h-8">
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => { setPickerIndex(i); setPickerOpen(true); }} aria-label={`Replace image ${i + 1}`} className="inline-flex h-11 min-w-0 flex-1 items-center justify-center rounded-md border border-border sm:h-8">
                  <ImageIcon className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => removeImage(i)} aria-label={`Remove image ${i + 1}`} className="inline-flex h-11 min-w-0 flex-1 items-center justify-center rounded-md border border-border sm:h-8">
                  <Trash className="h-4 w-4 text-destructive" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => moveImage(i, i + 1)} disabled={i === images.length - 1} aria-label={`Move image ${i + 1} later`} className="inline-flex h-11 min-w-0 flex-1 items-center justify-center rounded-md border border-border disabled:opacity-30 sm:h-8">
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              {i > 0 && (
                <button type="button" onClick={() => moveImage(i, 0)} className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-md text-xs font-medium text-primary hover:bg-muted sm:h-8">
                  Make main photo
                </button>
              )}
            </div>
          ))}
          {canUpload && (
            <button
              type="button"
              disabled={uploading}
              onClick={() => deviceFileRef.current?.click()}
              className="flex aspect-square w-full items-center justify-center self-start rounded-lg border-2 border-dashed border-primary/60 bg-primary/5 transition-colors hover:bg-primary/10 disabled:opacity-60 sm:h-28 sm:w-28"
            >
              <div className="px-1 text-center">
                <Upload className="mx-auto mb-1 h-6 w-6 text-primary" aria-hidden="true" />
                <span className="text-xs font-medium text-primary">{uploading ? 'Uploading…' : 'Upload photos'}</span>
              </div>
            </button>
          )}
          <button
            type="button"
            onClick={() => { setPickerIndex(null); setPickerOpen(true); }}
            className="flex aspect-square w-full items-center justify-center self-start rounded-lg border-2 border-dashed border-border bg-muted/20 transition-colors hover:border-primary hover:bg-muted/40 sm:h-28 sm:w-28"
          >
            <div className="px-1 text-center">
              <ImageIcon className="mx-auto mb-1 h-6 w-6 text-muted-foreground/60" aria-hidden="true" />
              <span className="text-xs text-muted-foreground">From library</span>
            </div>
          </button>
          <input
            ref={deviceFileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            aria-label="Photos to upload from this device"
            onChange={e => { void uploadFromDevice(e.target.files); e.target.value = ''; }}
          />
        </div>

        {uploadMessage && <p role="alert" className="mt-2 text-sm text-destructive">{uploadMessage}</p>}
        {uploading && <p role="status" className="mt-2 text-sm text-muted-foreground">Uploading photos. Stay on this page until they appear.</p>}

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
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
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

      <FormSection title="Stock & Inventory" description="On-hand quantity includes units reserved for orders. Available stock is on-hand minus reserved.">
        {hasVariants ? <p className="text-sm">Enter the stock quantity for each color in Color Variants below.</p> : <div className="max-w-sm space-y-2">
          <FormField id="stockQuantity" label="Stock quantity (on hand)" required>
            <input id="stockQuantity" type="number" min={initialData?.reserved ?? 0} max={1000000} step="1" required disabled={!canEditStock} value={stock} onChange={e => setStock(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </FormField>
          <p className="text-sm text-muted-foreground">Reserved: {initialData?.reserved ?? 0} · Available: {Math.max(0, Number(stock) - (initialData?.reserved ?? 0))}</p>
        </div>}
        {!canEditStock && <p className="text-sm text-muted-foreground">You need inventory write permission to change stock.</p>}
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
              <div key={i} className="flex flex-wrap items-center gap-3">
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
                  required
                  aria-label={`Color ${i + 1} name`}
                  className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                />
                <input
                  type="number"
                  step="0.01"
                  value={v.price ?? ''}
                  onChange={(e) => updateVariant(i, 'price', e.target.value)}
                  placeholder="Price (optional)"
                  aria-label={`Color ${i + 1} price`}
                  className="w-28 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                />
                <label className="text-xs">Stock quantity
                  <input type="number" aria-label={`Color ${i + 1} stock quantity`} min={v.reserved ?? 0} max={1000000} step="1" required disabled={!canEditStock} value={v.stock ?? ''} onChange={e => updateVariant(i, 'stock', e.target.value)} className="block w-28 rounded-md border border-border bg-background px-3 py-2 text-sm" />
                  <span className="text-muted-foreground">{v.reserved ?? 0} reserved · {Math.max(0, (v.stock ?? 0) - (v.reserved ?? 0))} available</span>
                </label>
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
        onCancel={() => router.push(listHref)}
        submitText={initialData ? 'Update Product' : 'Create Product'}
      />

      <MediaPicker
        isOpen={pickerOpen}
        onClose={() => { setPickerOpen(false); setPickerIndex(null); }}
        onSelect={(url) => addImage(url)}
        multiple={pickerIndex === null}
        categoryId={categoryId}
      />
    </form>
  );
}
