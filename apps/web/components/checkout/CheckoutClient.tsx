'use client';

import { useState } from 'react';
import { shippingFor, type DeliveryZone } from '@repo/config/delivery';
import { CheckoutForm } from './checkout-form';
import { CheckoutSummary, type CheckoutSummaryLine } from './checkout-summary';
import type { Address } from '@repo/database';

export interface AppliedCoupon {
  code: string;
  discount: number;
}

export interface DeliveryChoice {
  zone: DeliveryZone | null;
  location: string | null;
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
  /** Shown in the shop pickup box. */
  storeAddress: string;
  itemCount: number;
  lines: CheckoutSummaryLine[];
}

/**
 * Client wrapper sharing state between the checkout form and the order
 * summary: the applied coupon and the chosen delivery option/location.
 * Both previews are display-only — the authoritative delivery fee, discount
 * and total are always recalculated server-side in OrderRepository.createFromCart.
 */
export function CheckoutClient({
  isGuest,
  addresses,
  subtotal,
  storeAddress,
  itemCount,
  lines,
}: CheckoutClientProps) {
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [delivery, setDelivery] = useState<DeliveryChoice>({ zone: null, location: null });

  // null until a delivery option (and, if needed, a location) is chosen.
  const shipping = delivery.zone ? shippingFor(subtotal, delivery.zone, delivery.location) : null;

  return (
    <>
      <CheckoutForm
        isGuest={isGuest}
        addresses={addresses}
        subtotal={subtotal}
        storeAddress={storeAddress}
        delivery={delivery}
        onDeliveryChange={setDelivery}
        appliedCoupon={appliedCoupon}
        onCouponApplied={setAppliedCoupon}
      />
      <CheckoutSummary
        subtotal={subtotal}
        shipping={shipping}
        deliveryZone={delivery.zone}
        itemCount={itemCount}
        lines={lines}
        appliedCoupon={appliedCoupon}
      />
    </>
  );
}
