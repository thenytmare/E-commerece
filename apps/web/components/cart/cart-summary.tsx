import { calculateOrderTotals, FREE_SHIPPING_THRESHOLD_KES } from '@/lib/checkout';
import { formatPrice } from '@/lib/format';
import type { CartWithItems } from '@repo/database';
import { Button, Text } from '@repo/ui';
import Link from 'next/link';

interface CartSummaryProps {
  cart: CartWithItems;
}

export function CartSummary({ cart }: CartSummaryProps) {
  const { subtotal, shipping, total } = calculateOrderTotals(cart);
  const itemCount = cart.items.reduce((count, item) => count + item.quantity, 0);

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
      {subtotal < FREE_SHIPPING_THRESHOLD_KES ? (
        <Text variant="muted" className="mt-3 text-xs">
          Free shipping on orders over {formatPrice(FREE_SHIPPING_THRESHOLD_KES)}
        </Text>
      ) : null}
      <div className="mt-4 flex justify-between border-t border-border pt-4">
        <Text className="font-semibold">Estimated total</Text>
        <Text className="text-lg font-semibold">{formatPrice(total)}</Text>
      </div>
      <Button className="mt-6 w-full" asChild>
        <Link href="/checkout">Proceed to checkout</Link>
      </Button>
      <Button variant="outline" className="mt-3 w-full" asChild>
        <Link href="/products">Continue shopping</Link>
      </Button>
    </div>
  );
}
