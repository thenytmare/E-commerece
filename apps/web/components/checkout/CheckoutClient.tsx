'use client';

import { useState } from 'react';
import { CheckoutForm } from './checkout-form';
import { CheckoutSummary, type CheckoutSummaryLine } from './checkout-summary';
import type { Address } from '@repo/database';

export interface AppliedCoupon {
  code: string;
  discount: number;
}

interface CheckoutClientProps {
  /** True when nobody is signed in — the form then collects a contact email. */
  isGuest: boolean;
  addresses: Address[];
  /**
   * Totals are computed on the server and passed in as plain numbers.
   * This component must not import cart/checkout helpers directly — those
   * reach `next/headers` and cannot be bundled into a client component.
   */
  subtotal: number;
  shipping: number;
  itemCount: number;
  lines: CheckoutSummaryLine[];
}

/**
 * Client wrapper sharing applied-coupon state between the checkout form
 * (which submits the coupon code with the order) and the order summary
 * (which previews the discount). The preview is display-only — the
 * authoritative discount/total is always recalculated server-side in
 * OrderRepository.createFromCart.
 */
export function CheckoutClient({
  isGuest,
  addresses,
  subtotal,
  shipping,
  itemCount,
  lines,
}: CheckoutClientProps) {
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  return (
    <>
      <CheckoutForm
        isGuest={isGuest}
        addresses={addresses}
        subtotal={subtotal}
        appliedCoupon={appliedCoupon}
        onCouponApplied={setAppliedCoupon}
      />
      <CheckoutSummary
        subtotal={subtotal}
        shipping={shipping}
        itemCount={itemCount}
        lines={lines}
        appliedCoupon={appliedCoupon}
      />
    </>
  );
}
