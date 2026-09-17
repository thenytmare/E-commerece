'use client';

import React, { useState } from 'react';
import { FormSection } from '@/components/admin/forms/FormSection';
import { FormField } from '@/components/admin/forms/FormField';
import { FormActions } from '@/components/admin/forms/FormActions';
import { ValidationSummary } from '@/components/admin/forms/ValidationSummary';
import { createCategoryAction, updateCategoryAction } from '@/lib/actions/admin-categories';
import { ImageUrlField } from '@/components/admin/media/ImageUrlField';
import { useRouter } from 'next/navigation';
import type { Category } from '@prisma/client';
import { usePermissions } from '@/lib/hooks/use-permissions';

export function CategoryFormClient({
  initialData,
  availableParents
}: {
  initialData: Category | null;
  availableParents: { id: string; name: string }[];
}) {
  const router = useRouter();
  // The page lets a categories.read-only viewer open an existing category
  // to look at it, but they can't save — the fieldset keeps every field
  // genuinely inert instead of failing silently on submit.
  const { can } = usePermissions();
  const canWrite = can('categories.write');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    const formData = new FormData(e.currentTarget);
    let res;
    
    if (initialData) {
      res = await updateCategoryAction(initialData.id, null, formData);
    } else {
      res = await createCategoryAction(null, formData);
    }

    if (res.error) {
      setError(res.error);
      setIsSubmitting(false);
    } else {
      router.push('/admin/catalog/categories');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <ValidationSummary errors={[error]} />}
      {!canWrite && (
        <div className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          You have read-only access to categories — this form is view-only.
        </div>
      )}

      <fieldset disabled={!canWrite} className="space-y-6 border-0 p-0 m-0 min-w-0">
      <FormSection title="Basic Details" description="Core information about this category.">
        <div className="grid gap-6">
          <FormField id="name" label="Name" required>
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

          <FormField id="description" label="Description" description="A short description shown on the category page.">
            <textarea 
              id="description" 
              name="description" 
              defaultValue={initialData?.description || ''} 
              rows={3}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors resize-y" 
            />
          </FormField>

          <FormField id="imageUrl" label="Category Image" description="Pick from the Media Library or paste a URL.">
            <ImageUrlField
              id="imageUrl"
              name="imageUrl"
              defaultValue={initialData?.imageUrl || ''}
            />
          </FormField>
          
          <FormField id="parentId" label="Parent Category" description="Select a parent to create a nested hierarchy.">
            <select 
              id="parentId" 
              name="parentId" 
              defaultValue={initialData?.parentId || 'null'} 
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            >
              <option value="null">None (Top Level)</option>
              {availableParents.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Visibility & Ordering" description="Control how this category is displayed on the storefront.">
        <div className="grid gap-6">
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
              defaultChecked={initialData?.isFeatured || false}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium text-foreground">Featured (highlighted on storefront)</span>
          </label>
          
          <FormField id="sortOrder" label="Sort Order" description="Lower numbers appear first.">
            <input 
              type="number" 
              id="sortOrder" 
              name="sortOrder" 
              defaultValue={initialData?.sortOrder || 0} 
              className="w-full max-w-[150px] bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors" 
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="SEO Meta Data" description="Search engine optimization settings.">
        <div className="grid gap-6">
          <FormField id="seoTitle" label="SEO Title">
            <input 
              type="text" 
              id="seoTitle" 
              name="seoTitle" 
              defaultValue={initialData?.seoTitle || ''} 
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors" 
            />
          </FormField>
          
          <FormField id="seoDescription" label="SEO Description">
            <textarea 
              id="seoDescription" 
              name="seoDescription" 
              defaultValue={initialData?.seoDescription || ''} 
              rows={3}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors resize-y" 
            />
          </FormField>
        </div>
      </FormSection>

      </fieldset>

      <FormActions
        isSubmitting={isSubmitting}
        submitDisabled={!canWrite}
        onCancel={() => router.push('/admin/catalog/categories')}
        submitText={initialData ? 'Update Category' : 'Create Category'}
      />
    </form>
  );
}