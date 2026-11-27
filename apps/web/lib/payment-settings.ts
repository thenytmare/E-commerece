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
  /** Name the account is registered under, shown as "Account name" (optional). */
  accountName: string;
  /** Optional help number shown on the payment card. */
  contactPhone: string;
  /** Optional extra note shown under the payment steps. */
  instructions: string;
};

/**
 * On/off switches for the other ways to pay. They only ever turn a method OFF:
 * a method also needs its keys on the server before customers can see it.
 * Everything defaults to ON, so shops that saved settings before these
 * switches existed keep working exactly as before.
 */
export type PaymentMethodSwitches = {
  /** M-Pesa prompt (STK push) on the payment page. */
  mpesaStk: boolean;
  /** Card payments through Stripe. */
  card: boolean;
  /** Paystack checkout (card and M-Pesa). */
  paystack: boolean;
  /** Cash on Delivery (Nairobi only). */
  cod: boolean;
};

export type PaymentSettings = {
  manualMpesa: ManualMpesaSettings;
  methods: PaymentMethodSwitches;
};

export const DEFAULT_METHOD_SWITCHES: PaymentMethodSwitches = {
  mpesaStk: true,
  card: true,
  paystack: true,
  cod: true,
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
  const methods = (value.methods ?? {}) as Record<string, unknown>;

  const paybillNumber = String(manual.paybillNumber ?? '').trim();
  const accountNumber = String(manual.accountNumber ?? '').trim();

  return {
    methods: {
      // Off only when it was explicitly switched off.
      mpesaStk: methods.mpesaStk !== false,
      card: methods.card !== false,
      paystack: methods.paystack !== false,
      cod: methods.cod !== false,
    },
    manualMpesa: {
      // Only ever treat the method as live when it is both switched on AND has
      // the two numbers a customer needs — a half-configured Paybill is worse
      // than none, because the customer pays into nothing.
      enabled: Boolean(manual.enabled) && paybillNumber.length > 0 && accountNumber.length > 0,
      businessName: String(manual.businessName ?? '').trim(),
      paybillNumber,
      accountNumber,
      accountName: String(manual.accountName ?? '').trim(),
      contactPhone: String(manual.contactPhone ?? '').trim(),
      instructions: String(manual.instructions ?? '').trim(),
    },
  };
});
