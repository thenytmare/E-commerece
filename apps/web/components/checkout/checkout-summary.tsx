'use client';

import { formatPrice } from '@/lib/format';
import { Text } from '@repo/ui';
import type { AppliedCoupon } from './CheckoutClient';

/** One order line, pre-serialized on the server (no Prisma Decimals). */
export interface CheckoutSummaryLine {
  id: string;
  name: string;
  quantity: number;
  lineTotal: number;
}

interface CheckoutSummaryProps {
  subtotal: number;
  shipping: number;
  itemCount: number;
  lines: CheckoutSummaryLine[];
  appliedCoupon?: AppliedCoupon | null;
}

export function CheckoutSummary({
  subtotal,
  shipping,
  itemCount,
  lines,
  appliedCoupon,
}: CheckoutSummaryProps) {
  const discount = appliedCoupon?.discount ?? 0;
  const total = Math.max(0, subtotal + shipping - discount);

  return (
    // On mobile this renders before the address form (order-1) so the total
    // is visible before a shopper commits to "Continue to payment" — on
    // desktop it reverts to its natural place in the right-hand column.
    <div className="order-1 rounded-xl border border-border bg-card p-6 shadow-soft lg:order-none">
      <Text className="mb-4 font-semibold">Order Summary</Text>
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">
            Subtotal ({itemCount} item{itemCount === 1 ? '' : 's'})
          </dt>
          <dd className="font-medium">{formatPrice(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Shipping</dt>
          <dd className="font-medium">
            {shipping === 0 ? 'Free' : formatPrice(shipping)}
          </dd>
        </div>
        {appliedCoupon ? (
          <div className="flex justify-between text-primary">
            <dt>Coupon ({appliedCoupon.code})</dt>
            <dd className="font-medium">-{formatPrice(discount)}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-4 space-y-3 border-t border-border pt-4">
        {lines.map((line) => (
          <div key={line.id} className="flex justify-between gap-4 text-sm">
            <span className="line-clamp-1 text-muted-foreground">
              {line.name} × {line.quantity}
            </span>
            <span className="shrink-0 font-medium">{formatPrice(line.lineTotal)}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-between border-t border-border pt-4">
        <Text className="font-semibold">Total</Text>
        <Text className="text-lg font-semibold">{formatPrice(total)}</Text>
      </div>
      <Text variant="muted" className="mt-3 text-xs">
        You will choose a payment method on the next step.
      </Text>
    </div>
  );
}
