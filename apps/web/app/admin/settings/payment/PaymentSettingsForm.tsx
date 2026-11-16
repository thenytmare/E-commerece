'use client';

import React, { useState } from 'react';
import { FormSection } from '@/components/admin/forms/FormSection';
import { FormField } from '@/components/admin/forms/FormField';
import { FormActions } from '@/components/admin/forms/FormActions';
import { ValidationSummary } from '@/components/admin/forms/ValidationSummary';
import { updatePaymentSettingsAction } from '@/lib/actions/admin-settings';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/hooks/use-permissions';
import type { PaymentSettings } from '@/lib/payment-settings';

type Props = {
  settings: PaymentSettings;
};

const inputClass =
  'w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors';

export function PaymentSettingsForm({ settings }: Props) {
  const router = useRouter();
  const { can } = usePermissions();
  const canWrite = can('settings.write');
  const manual = settings.manualMpesa;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setFieldErrors({});
    setSuccessMessage(null);

    const formData = new FormData(e.currentTarget);
    const res = await updatePaymentSettingsAction(null, formData);

    if (res.error) {
      setError(res.error);
      if (res.fieldErrors) setFieldErrors(res.fieldErrors);
    } else {
      setSuccessMessage('Payment settings saved successfully.');
      router.refresh();
    }
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <ValidationSummary errors={[error]} />}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 text-green-800 dark:text-green-300 rounded-md px-4 py-3 text-sm">
          {successMessage}
        </div>
      )}
      {!canWrite && (
        <div className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          You have read-only access to settings — this form is view-only.
        </div>
      )}

      <fieldset disabled={!canWrite} className="space-y-6 border-0 p-0 m-0 min-w-0">
        <FormSection
          title="M-Pesa Paybill (manual)"
          description="Customers pay to this Paybill and submit the M-Pesa confirmation code. A staff member checks the code against your statement and confirms the order under Sales › Payment confirmations."
        >
          <div className="grid gap-6">
            <label className="flex items-start gap-3 rounded-md border border-border bg-background px-4 py-3">
              <input
                type="checkbox"
                name="manualMpesaEnabled"
                defaultChecked={manual.enabled}
                className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm">
                <span className="font-medium text-foreground">Show M-Pesa Paybill at checkout</span>
                <span className="block text-muted-foreground">
                  When on, customers see the Paybill details and a box to paste their M-Pesa code on
                  the payment page. Needs the Paybill and account number below.
                </span>
              </span>
            </label>

            <FormField
              id="businessName"
              label="Paying to (business name)"
              description='Shown to customers as "Paying to ..." on the payment page (optional).'
            >
              <input
                type="text"
                id="businessName"
                name="businessName"
                defaultValue={manual.businessName}
                placeholder="Prime Accessories Kenya"
                className={inputClass}
              />
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                id="paybillNumber"
                label="Paybill number"
                required
                description="Your Safaricom Paybill (business short code), 5–7 digits."
                error={fieldErrors.paybillNumber}
              >
                <input
                  type="text"
                  inputMode="numeric"
                  id="paybillNumber"
                  name="paybillNumber"
                  defaultValue={manual.paybillNumber}
                  placeholder="400200"
                  className={inputClass}
                />
              </FormField>

              <FormField
                id="accountNumber"
                label="Account number"
                required
                description="The fixed account/reference every customer enters. Same value for all orders."
                error={fieldErrors.accountNumber}
              >
                <input
                  type="text"
                  id="accountNumber"
                  name="accountNumber"
                  defaultValue={manual.accountNumber}
                  placeholder="PRIME"
                  className={inputClass}
                />
              </FormField>
            </div>

            <FormField
              id="accountName"
              label="Account name"
              description='Shown to customers as "Account name ..." under the Paybill details (optional).'
            >
              <input
                type="text"
                id="accountName"
                name="accountName"
                defaultValue={manual.accountName}
                placeholder="Prime Accessories Kenya"
                className={inputClass}
              />
            </FormField>

            <FormField
              id="contactPhone"
              label="Help phone number"
              description="Shown on the payment page for customers who need help (optional)."
            >
              <input
                type="text"
                id="contactPhone"
                name="contactPhone"
                defaultValue={manual.contactPhone}
                placeholder="+254 700 000 000"
                className={inputClass}
              />
            </FormField>

            <FormField
              id="instructions"
              label="Extra instructions"
              description="An optional note shown under the payment steps (optional)."
            >
              <textarea
                id="instructions"
                name="instructions"
                defaultValue={manual.instructions}
                rows={3}
                placeholder="Payments are usually confirmed within a few minutes during working hours."
                className={inputClass}
              />
            </FormField>
          </div>
        </FormSection>
      </fieldset>

      <FormActions
        isSubmitting={isSubmitting}
        submitDisabled={!canWrite}
        onCancel={() => router.push('/admin')}
        submitText="Save Payment Settings"
      />
    </form>
  );
}
