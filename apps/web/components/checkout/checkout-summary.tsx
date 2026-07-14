import { calculateOrderTotals } from '@/lib/checkout';
import { formatPrice } from '@/lib/format';
import type { CartWithItems } from '@repo/database';
import { Text } from '@repo/ui';

interface CheckoutSummaryProps {
  cart: CartWithItems;
}

export function CheckoutSummary({ cart }: CheckoutSummaryProps) {
  const { subtotal, shipping, total } = calculateOrderTotals(cart);
  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
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
      </dl>
      <div className="mt-4 space-y-3 border-t border-border pt-4">
        {cart.items.map((item) => (
          <div key={item.id} className="flex justify-between gap-4 text-sm">
            <span className="line-clamp-1 text-muted-foreground">
              {item.variant.product.name} × {item.quantity}
            </span>
            <span className="shrink-0 font-medium">
              {formatPrice(
                (typeof item.variant.price === 'object' && 'toNumber' in item.variant.price
                  ? item.variant.price.toNumber()
                  : Number(item.variant.price)) * item.quantity
              )}
            </span>
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
