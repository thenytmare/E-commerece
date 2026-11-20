'use server';

import { createRepositories } from '@repo/database';
import { requirePermission } from './auth';
import { revalidatePath, revalidateTag } from 'next/cache';
import {
  parseFormData,
  storeSettingsSchema,
  paymentSettingsSchema,
  type FieldErrors,
} from '@/lib/validations/admin';
import { getClientIp } from '@/lib/request-context';

const repos = createRepositories();

export type StoreSettingsActionState = {
  success?: boolean;
  error?: string;
  fieldErrors?: FieldErrors;
};

export async function updateStoreSettingsAction(
  _prevState: StoreSettingsActionState | null,
  formData: FormData
): Promise<StoreSettingsActionState> {
  await requirePermission('settings.write');

  const validation = parseFormData(storeSettingsSchema, formData);
  if (validation.fieldErrors) {
    return {
      success: false,
      error: 'Please correct the highlighted fields.',
      fieldErrors: validation.fieldErrors,
    };
  }
  const { name, phone, email, address, currency, whatsappNumber } = validation.data;

  try {
    await repos.siteSetting.upsert('store', {
      name,
      phone,
      email,
      address: address ?? '',
      currency,
      // Fall back to the main phone when no dedicated WhatsApp number is set.
      whatsappNumber: (whatsappNumber ?? phone).replace(/[^0-9+]/g, ''),
    } satisfies Record<string, unknown>);
    revalidatePath('/admin/settings/store'); revalidateTag('settings');
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error) {
    console.error('Failed to save store settings:', error);
    return { success: false, error: 'Failed to save settings.' };
  }
}

export async function updatePaymentSettingsAction(
  _prevState: StoreSettingsActionState | null,
  formData: FormData
): Promise<StoreSettingsActionState> {
  const session = await requirePermission('settings.write');

  const validation = parseFormData(paymentSettingsSchema, formData);
  if (validation.fieldErrors) {
    return {
      success: false,
      error: 'Please correct the highlighted fields.',
      fieldErrors: validation.fieldErrors,
    };
  }
  const {
    manualMpesaEnabled,
    businessName,
    paybillNumber,
    accountNumber,
    accountName,
    contactPhone,
    instructions,
  } = validation.data;

  try {
    await repos.siteSetting.upsert('payment', {
      manualMpesa: {
        enabled: manualMpesaEnabled,
        businessName: businessName ?? '',
        paybillNumber,
        accountNumber,
        accountName: accountName ?? '',
        contactPhone: contactPhone ?? '',
        instructions: instructions ?? '',
      },
    } satisfies Record<string, unknown>);

    // Payment config controls whether real buyers see a live Paybill, so keep
    // a record of who changed it.
    await repos.auditLog.create({
      actorId: session.user.id,
      ipAddress: (await getClientIp()) ?? undefined,
      action: 'settings.payment_updated',
      entity: 'Setting',
      entityId: 'payment',
      metadata: {
        manualMpesaEnabled,
        paybillNumber,
        accountNumber,
      },
    });

    revalidatePath('/admin/settings/payment');
    revalidateTag('settings');
    return { success: true };
  } catch (error) {
    console.error('Failed to save payment settings:', error);
    return { success: false, error: 'Failed to save settings.' };
  }
}