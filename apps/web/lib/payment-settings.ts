import { cache } from 'react';
import { getCachedSetting } from '@/lib/catalog-cache';

/**
 * Manual M-Pesa Paybill settings.
 *
 * A stop-gap until a real payment gateway is wired up: the customer pays to
 * the Paybill shown on the payment page, submits the M-Pesa confirmation code,
 * and a staff member verifies it by hand before the order is confirmed.
 */
export type ManualMpesaSettings = {
  enabled: boolean;
  businessName: string;
  paybillNumber: string;
  /** Fixed account/reference number shown to every customer. */
  accountNumber: string;
  /** Optional help number shown on the payment card. */
  contactPhone: string;
  /** Optional extra note shown under the payment steps. */
  instructions: string;
};

export type PaymentSettings = {
  manualMpesa: ManualMpesaSettings;
};

/**
 * Read manual-payment settings, deduped per request like getStoreSettings.
 * Returns a disabled default when nothing has been configured yet, so the
 * storefront never shows an empty Paybill.
 */
export const getPaymentSettings = cache(async (): Promise<PaymentSettings> => {
  const setting = await getCachedSetting('payment');
  const value = (setting?.value ?? {}) as Record<string, unknown>;
  const manual = (value.manualMpesa ?? {}) as Record<string, unknown>;

  const paybillNumber = String(manual.paybillNumber ?? '').trim();
  const accountNumber = String(manual.accountNumber ?? '').trim();

  return {
    manualMpesa: {
      // Only ever treat the method as live when it is both switched on AND has
      // the two numbers a customer needs — a half-configured Paybill is worse
      // than none, because the customer pays into nothing.
      enabled: Boolean(manual.enabled) && paybillNumber.length > 0 && accountNumber.length > 0,
      businessName: String(manual.businessName ?? '').trim(),
      paybillNumber,
      accountNumber,
      contactPhone: String(manual.contactPhone ?? '').trim(),
      instructions: String(manual.instructions ?? '').trim(),
    },
  };
});
