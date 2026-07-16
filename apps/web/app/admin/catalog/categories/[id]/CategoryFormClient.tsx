'use client';

import React, { useState } from 'react';
import { FormSection } from '@/components/admin/forms/FormSection';
import { FormField } from '@/components/admin/forms/FormField';
import { FormActions } from '@/components/admin/forms/FormActions';
import { ValidationSummary } from '@/components/admin/forms/ValidationSummary';
import { createCategoryAction, updateCategoryAction } from '@/lib/actions/admin-categories';
import { useRouter } from 'next/navigation';
import type { Category } from '@prisma/client';

export function CategoryFormClient({ 
  initialData, 
  availableParents 
}: { 
  initialData: Category | null,
  availableParents: { id: string, name: string }[]
}) {
  const router = useRouter();
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
      
      <FormSection title="Basic Details" description="Information about this category.">
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
          
          <FormField id="parentId" label="Parent Category">
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

      <FormSection title="Visibility & Ordering" description="Control how this category is displayed.">
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

      <FormActions 
        isSubmitting={isSubmitting} 
        onCancel={() => router.push('/admin/catalog/categories')} 
        submitText={initialData ? 'Update Category' : 'Create Category'} 
      />
    </form>
  );
}
