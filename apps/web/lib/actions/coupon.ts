'use server';

import { createRepositories } from '@repo/database';
import { formatPrice } from '@/lib/format';
import { clientIdentifier, rateLimit, retryMessage } from '@/lib/rate-limit';

export type CouponPreview = {
  valid: boolean;
  error?: string;
  code?: string;
  discount?: number;
};

/**
 * Preview-only coupon check for the checkout UI. Not authoritative — the
 * real validation, discount calculation, and usage-count increment happen
 * inside OrderRepository.createFromCart's transaction at order-placement
 * time, so this can never be used to bypass expiry/usage-limit checks.
 */
export async function validateCouponAction(code: string, subtotal: number): Promise<CouponPreview> {
  const trimmed = code.trim();
  if (!trimmed) {
    return { valid: false, error: 'Enter a coupon code' };
  }

  // Unauthenticated and easy to script — this is the guard against
  // brute-force enumeration of valid promo codes, not against normal
  // shoppers occasionally mistyping one.
  const limit = rateLimit(`coupon:${await clientIdentifier()}`, 20, 5 * 60_000);
  if (!limit.allowed) {
    return { valid: false, error: retryMessage(limit.retryAfterSeconds) };
  }

  const repos = createRepositories();
  const coupon = await repos.coupon.findByCode(trimmed);

  if (!coupon) {
    return { valid: false, error: 'This coupon code is invalid or has expired' };
  }
  if (coupon.minOrder !== null && subtotal < Number(coupon.minOrder)) {
    return {
      valid: false,
      error: `This coupon requires a minimum order of ${formatPrice(Number(coupon.minOrder))}`,
    };
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, error: 'This coupon has reached its usage limit' };
  }

  // Clamp to subtotal in both branches — a percentage coupon configured above
  // 100 (or a fixed coupon larger than the order) must never produce a negative
  // preview total. OrderRepository.createFromCart applies the same clamp at
  // order-creation time, so this keeps the preview consistent with the charge.
  const rawDiscount =
    coupon.type === 'PERCENTAGE'
      ? Math.round((subtotal * Number(coupon.value)) / 100)
      : Number(coupon.value);
  const discount = Math.min(Math.max(rawDiscount, 0), subtotal);

  return { valid: true, code: coupon.code, discount };
}
