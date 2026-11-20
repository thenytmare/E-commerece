'use client';

import React, { useState } from 'react';
import { FormSection } from '@/components/admin/forms/FormSection';
import { FormField } from '@/components/admin/forms/FormField';
import { FormActions } from '@/components/admin/forms/FormActions';
import { ValidationSummary } from '@/components/admin/forms/ValidationSummary';
import { createBrandAction, updateBrandAction } from '@/lib/actions/admin-brands';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/hooks/use-permissions';

interface BrandFormData {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  website: string | null;
  country: string | null;
  isFeatured: boolean;
  isActive: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
}

export function BrandFormClient({ initialData }: { initialData: BrandFormData | null }) {
  const router = useRouter();
  // The page lets a brands.read-only viewer open an existing brand to look
  // at it, but they can't save — the fieldset keeps every field genuinely
  // inert instead of failing silently on submit.
  const { can } = usePermissions();
  const canWrite = can('brands.write');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const res = initialData
      ? await updateBrandAction(initialData.id, null, formData)
      : await createBrandAction(null, formData);
    if (res.error) {
      setError(res.error);
      setIsSubmitting(false);
    } else {
      router.push('/admin/catalog/brands');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && <ValidationSummary errors={[error]} />}
      {!canWrite && (
        <div className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          You have read-only access to brands — this form is view-only.
        </div>
      )}

      <fieldset disabled={!canWrite} className="space-y-6 border-0 p-0 m-0 min-w-0">
      <FormSection title="Basic Details" description="Brand identity and public information.">
        <div className="grid gap-6">
          <FormField id="name" label="Name" required>
            <input
              type="text" id="name" name="name" defaultValue={initialData?.name || ''} required
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>
          <FormField id="slug" label="URL Slug" required description="Unique URL-friendly identifier.">
            <input
              type="text" id="slug" name="slug" defaultValue={initialData?.slug || ''} required
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>
          <FormField id="logoUrl" label="Logo URL">
            <input
              type="url" id="logoUrl" name="logoUrl" defaultValue={initialData?.logoUrl || ''} placeholder="https://example.com/logo.png"
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>
          <FormField id="description" label="Description" description="Brand story or about text.">
            <textarea
              id="description" name="description" defaultValue={initialData?.description || ''} rows={3}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Additional Info" description="Website, country, and featured flag.">
        <div className="grid gap-6">
          <FormField id="website" label="Website" description="Brand official website URL.">
            <input
              type="url" id="website" name="website" defaultValue={initialData?.website || ''} placeholder="https://example.com"
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>
          <FormField id="country" label="Country" description="Country of origin.">
            <input
              type="text" id="country" name="country" defaultValue={initialData?.country || ''} placeholder="Kenya"
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>
          <label className="flex items-center gap-3">
            <input
              type="checkbox" name="isFeatured" defaultChecked={initialData?.isFeatured || false}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium text-foreground">Featured brand</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox" name="isActive" defaultChecked={initialData ? initialData.isActive : true}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium text-foreground">Active (visible on storefront)</span>
          </label>
        </div>
      </FormSection>

      <FormSection title="SEO Meta Data" description="Search engine optimization settings.">
        <div className="grid gap-6">
          <FormField id="seoTitle" label="SEO Title">
            <input
              type="text" id="seoTitle" name="seoTitle" defaultValue={initialData?.seoTitle || ''}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>
          <FormField id="seoDescription" label="SEO Description">
            <textarea
              id="seoDescription" name="seoDescription" defaultValue={initialData?.seoDescription || ''} rows={3}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y"
            />
          </FormField>
        </div>
      </FormSection>

      </fieldset>

      <FormActions
        isSubmitting={isSubmitting}
        submitDisabled={!canWrite}
        onCancel={() => router.push('/admin/catalog/brands')}
        submitText={initialData ? 'Update Brand' : 'Create Brand'}
      />
    </form>
  );
}