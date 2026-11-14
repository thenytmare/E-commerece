'use client';

import React, { useState } from 'react';
import { FormSection } from '@/components/admin/forms/FormSection';
import { FormField } from '@/components/admin/forms/FormField';
import { FormActions } from '@/components/admin/forms/FormActions';
import { ValidationSummary } from '@/components/admin/forms/ValidationSummary';
import { updateStoreSettingsAction } from '@/lib/actions/admin-settings';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/hooks/use-permissions';

type Props = {
  settings: {
    name: string;
    phone: string;
    email: string;
    address: string;
    currency: string;
  };
};

export function StoreSettingsForm({ settings }: Props) {
  const router = useRouter();
  const { can } = usePermissions();
  const canWrite = can('settings.write');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    const formData = new FormData(e.currentTarget);
    const res = await updateStoreSettingsAction(null, formData);

    if (res.error) {
      setError(res.error);
    } else {
      setSuccessMessage('Settings saved successfully.');
      router.refresh();
    }
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <ValidationSummary errors={[error]} />}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-md px-4 py-3 text-sm">
          {successMessage}
        </div>
      )}
      {!canWrite && (
        <div className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          You have read-only access to settings — this form is view-only.
        </div>
      )}

      <fieldset disabled={!canWrite} className="space-y-6 border-0 p-0 m-0 min-w-0">
      <FormSection title="Store Information" description="These details appear on your storefront and are used for customer communications.">
        <div className="grid gap-6">
          <FormField id="name" label="Store Name" required>
            <input
              type="text"
              id="name"
              name="name"
              defaultValue={settings.name}
              required
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField id="phone" label="Phone Number" required description="Used for WhatsApp inquiries and contact.">
              <input
                type="text"
                id="phone"
                name="phone"
                defaultValue={settings.phone}
                required
                placeholder="+254 700 000 000"
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
              />
            </FormField>

            <FormField id="email" label="Email Address" required>
              <input
                type="email"
                id="email"
                name="email"
                defaultValue={settings.email}
                required
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
              />
            </FormField>
          </div>

          <FormField id="address" label="Store Address">
            <input
              type="text"
              id="address"
              name="address"
              defaultValue={settings.address}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            />
          </FormField>

          <FormField id="currency" label="Currency" required>
            <select
              id="currency"
              name="currency"
              defaultValue={settings.currency}
              required
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            >
              <option value="KES">KES (Kenyan Shilling)</option>
              <option value="USD">USD (US Dollar)</option>
              <option value="EUR">EUR (Euro)</option>
              <option value="GBP">GBP (British Pound)</option>
            </select>
          </FormField>
        </div>
      </FormSection>
      </fieldset>

      <FormActions
        isSubmitting={isSubmitting}
        submitDisabled={!canWrite}
        onCancel={() => router.push('/admin')}
        submitText="Save Settings"
      />
    </form>
  );
}