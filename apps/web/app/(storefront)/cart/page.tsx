import { CartItemRow } from '@/components/cart/cart-item-row';
import { CartSummary } from '@/components/cart/cart-summary';
import { resolveCart, resolveCartUnitPrices } from '@/lib/cart';
import { toPublicCartItem } from '@/lib/cart-view';
import { serializeDecimals } from '@/lib/serialize';
import { Button, Container, Grid, Heading, Section, Text } from '@repo/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { readGuestOrderNumbers } from '@/lib/guest-orders';
import { createRepositories } from '@repo/database';
import { SavedCheckout } from '@/components/cart/saved-checkout';

export const metadata: Metadata = {
  title: 'Cart',
  description: 'Review items in your Prime Accessories Kenya shopping cart.',
};

export default async function CartPage() {
  const { cart } = await resolveCart();
  const [session, guestOrderNumbers] = await Promise.all([auth(), readGuestOrderNumbers()]);
  const saved = await createRepositories().order.findRecoverableCheckouts({ userId: session?.user?.id, guestOrderNumbers, cartId: cart?.id });
  // Flash-sale-aware prices, resolved once and shared by the rows and summary.
  const unitPrices = cart ? await resolveCartUnitPrices(cart) : new Map<string, number>();

  return (
    <main>
      <Section spacing="md" className="border-b border-border bg-card">
        <Container>
          <Heading as="h1" size="lg">
            Shopping Cart
          </Heading>
        </Container>
      </Section>

      <Section>
        <Container>
          {saved.map(order => <SavedCheckout key={order.orderNumber} order={{ ...order, total: Number(order.total) }} />)}
          {(!cart || cart.items.length === 0) && saved.length > 0 ? <p className="text-sm text-muted-foreground">Your checkout items are saved above. You can also <Link href="/products" className="underline">continue shopping</Link>.</p> : !cart || cart.items.length === 0 ? (
            <div className="mx-auto max-w-md rounded-xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
              <Heading as="h2" size="sm" className="mb-3">
                Your cart is empty
              </Heading>
              <Text variant="muted" className="mb-6">
                Browse our catalog and add items to get started.
              </Text>
              <Button asChild>
                <Link href="/products">Shop products</Link>
              </Button>
            </div>
          ) : (
            <Grid cols={1} gap="lg" className="lg:grid-cols-[1fr_360px]">
              <div className="rounded-xl border border-border bg-card px-6">
                {cart.items.map((item) => (
                  // Serialized because CartItemRow is a Client Component and
                  // variant prices come back from Prisma as Decimal.
                  <CartItemRow
                    key={item.id}
                    item={toPublicCartItem(serializeDecimals(item))}
                    unitPrice={unitPrices.get(item.variantId)!}
                  />
                ))}
              </div>
              <CartSummary cart={cart} />
            </Grid>
          )}
        </Container>
      </Section>
    </main>
  );
}
