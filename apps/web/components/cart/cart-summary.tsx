import { isCartItemAvailable } from '@/lib/cart-view';
import { calculateOrderTotals, FREE_SHIPPING_THRESHOLD_KES } from '@/lib/checkout';
import { formatPrice } from '@/lib/format';
import type { CartWithItems } from '@repo/database';
import { Button, Text } from '@repo/ui';
import Link from 'next/link';

interface CartSummaryProps {
  cart: CartWithItems;
}

export async function CartSummary({ cart }: CartSummaryProps) {
  const { subtotal } = await calculateOrderTotals(cart);
  const unavailableCount = cart.items.filter((item) => !isCartItemAvailable(item)).length;
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
          <dt className="text-muted-foreground">Delivery</dt>
          <dd className="font-medium text-muted-foreground">
            {subtotal >= FREE_SHIPPING_THRESHOLD_KES ? 'Free' : 'Calculated at checkout'}
          </dd>
        </div>
      </dl>
      {subtotal < FREE_SHIPPING_THRESHOLD_KES ? (
        <Text variant="muted" className="mt-3 text-xs">
          Delivery from {formatPrice(100)} in Nairobi CBD. Free shop pickup, and free delivery on
          orders over {formatPrice(FREE_SHIPPING_THRESHOLD_KES)}
        </Text>
      ) : null}
      <div className="mt-4 flex justify-between border-t border-border pt-4">
        <Text className="font-semibold">Subtotal</Text>
        <Text className="text-lg font-semibold">{formatPrice(subtotal)}</Text>
      </div>
      {unavailableCount > 0 ? (
        <>
          <Text className="mt-4 text-sm text-destructive" role="alert">
            {unavailableCount === 1
              ? 'One item is no longer available. Remove it to continue.'
              : `${unavailableCount} items are no longer available. Remove them to continue.`}
          </Text>
          <Button className="mt-4 w-full" disabled>
            Proceed to checkout
          </Button>
        </>
      ) : (
        <Button className="mt-6 w-full" asChild>
          <Link href="/checkout">Proceed to checkout</Link>
        </Button>
      )}
      <Button variant="outline" className="mt-3 w-full" asChild>
        <Link href="/products">Continue shopping</Link>
      </Button>
    </div>
  );
}
