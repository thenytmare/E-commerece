'use server';

import { createRepositories } from '@repo/database';
import { requirePermission } from './auth';
import { revalidatePath } from 'next/cache';
import { couponSchema, parseFormData, type FieldErrors } from '@/lib/validations/admin';

const repos = createRepositories();

export type CouponActionState = {
  success?: boolean;
  error?: string;
  fieldErrors?: FieldErrors;
};

/** Parses the optional scheduling window shared by create and update. */
function parseWindow(formData: FormData): { startsAt: Date | null; endsAt: Date | null } | { error: string } {
  const startsRaw = String(formData.get('startsAt') ?? '').trim();
  const endsRaw = String(formData.get('endsAt') ?? '').trim();

  const startsAt = startsRaw ? new Date(startsRaw) : null;
  const endsAt = endsRaw ? new Date(endsRaw) : null;

  if (startsAt && Number.isNaN(startsAt.getTime())) return { error: 'Enter a valid start date.' };
  if (endsAt && Number.isNaN(endsAt.getTime())) return { error: 'Enter a valid end date.' };
  if (startsAt && endsAt && endsAt <= startsAt) {
    return { error: 'The end date must be after the start date.' };
  }
  return { startsAt, endsAt };
}

export async function createCouponAction(
  _prevState: CouponActionState | null,
  formData: FormData
): Promise<CouponActionState> {
  await requirePermission('marketing.write');

  const validation = parseFormData(couponSchema, formData);
  if (validation.fieldErrors) {
    return { success: false, error: 'Please correct the highlighted fields.', fieldErrors: validation.fieldErrors };
  }
  const window = parseWindow(formData);
  if ('error' in window) {
    return { success: false, error: window.error };
  }

  try {
    await repos.coupon.create({ ...validation.data, ...window });
    revalidatePath('/admin/marketing/coupons');
    return { success: true };
  } catch (error) {
    console.error('Failed to create coupon:', error);
    return { success: false, error: 'Failed to create coupon. Code may already exist.' };
  }
}

export async function updateCouponAction(
  id: string,
  _prevState: CouponActionState | null,
  formData: FormData
): Promise<CouponActionState> {
  await requirePermission('marketing.write');

  const validation = parseFormData(couponSchema, formData);
  if (validation.fieldErrors) {
    return { success: false, error: 'Please correct the highlighted fields.', fieldErrors: validation.fieldErrors };
  }
  const window = parseWindow(formData);
  if ('error' in window) {
    return { success: false, error: window.error };
  }

  try {
    await repos.coupon.update(id, { ...validation.data, ...window });
    revalidatePath('/admin/marketing/coupons');
    return { success: true };
  } catch (error) {
    console.error('Failed to update coupon:', error);
    return { success: false, error: 'Failed to update coupon.' };
  }
}

export async function deleteCouponAction(id: string): Promise<{ success: boolean }> {
  await requirePermission('marketing.write');
  try {
    await repos.coupon.delete(id);
    revalidatePath('/admin/marketing/coupons');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete coupon:', error);
    return { success: false };
  }
}