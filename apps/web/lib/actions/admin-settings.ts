'use server';

import { createRepositories } from '@repo/database';
import { requirePermission } from './auth';
import { revalidatePath } from 'next/cache';
import { parseFormData, storeSettingsSchema, type FieldErrors } from '@/lib/validations/admin';

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
    revalidatePath('/admin/settings/store');
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error) {
    console.error('Failed to save store settings:', error);
    return { success: false, error: 'Failed to save settings.' };
  }
}