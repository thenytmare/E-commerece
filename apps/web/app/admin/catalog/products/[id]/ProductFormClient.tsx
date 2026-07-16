'use client';

import React, { useState } from 'react';
import { FormSection } from '@/components/admin/forms/FormSection';
import { FormField } from '@/components/admin/forms/FormField';
import { FormActions } from '@/components/admin/forms/FormActions';
import { ValidationSummary } from '@/components/admin/forms/ValidationSummary';
import { RichTextField } from '@/components/admin/forms/RichTextField';
import { createProductAction, updateProductAction } from '@/lib/actions/admin-products';
import { useRouter } from 'next/navigation';
import type { ProductDetail } from '@repo/database';

export function ProductFormClient({ 
  initialData, 
  categories,
  brands
}: { 
  initialData: ProductDetail | null,
  categories: { id: string, name: string }[],
  brands: { id: string, name: string }[]
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState(initialData?.description || '');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    const formData = new FormData(e.currentTarget);
    formData.set('description', description);
    
    let res;
    
    if (initialData) {
      res = await updateProductAction(initialData.id, null, formData);
    } else {
      res = await createProductAction(null, formData);
    }

    if (res.error) {
      setError(res.error);
      setIsSubmitting(false);
    } else {
      router.push('/admin/catalog/products');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <ValidationSummary errors={[error]} />}
      
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
          
          <FormField id="slug" label="URL Slug" required description="The URL-friendly version of the name.">
            <input 
              type="text" 
              id="slug" 
              name="slug" 
              defaultValue={initialData?.slug || ''} 
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
          <FormField id="basePrice" label="Base Price ($)" required>
            <input 
              type="number" 
              step="0.01"
              id="basePrice" 
              name="basePrice" 
              defaultValue={initialData ? Number(initialData.basePrice) : ''} 
              required
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors" 
            />
          </FormField>
          
          <FormField id="compareAtPrice" label="Compare at Price ($)" description="Original price for showing discounts.">
            <input 
              type="number" 
              step="0.01"
              id="compareAtPrice" 
              name="compareAtPrice" 
              defaultValue={initialData?.compareAtPrice ? Number(initialData.compareAtPrice) : ''} 
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors" 
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Descriptions" description="Tell your customers about the product.">
        <div className="grid gap-6">
          <FormField id="shortDescription" label="Short Description">
            <textarea 
              id="shortDescription" 
              name="shortDescription" 
              defaultValue={initialData?.shortDescription || ''} 
              rows={2}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors resize-y" 
            />
          </FormField>
          
          <FormField id="description" label="Full Description">
            <RichTextField value={description} onChange={setDescription} />
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
        </div>
      </FormSection>

      <FormActions 
        isSubmitting={isSubmitting} 
        onCancel={() => router.push('/admin/catalog/products')} 
        submitText={initialData ? 'Update Product' : 'Create Product'} 
      />
    </form>
  );
}
