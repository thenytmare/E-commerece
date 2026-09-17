import { CheckoutClient } from '@/components/checkout/CheckoutClient';
import { calculateOrderTotals } from '@/lib/checkout';
import { auth } from '@/auth';
import { resolveCart } from '@/lib/cart';
import { createRepositories } from '@repo/database';
import { Container, Grid, Heading, Section, Text } from '@repo/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Complete your Prime Accessories Kenya order.',
};

export default async function CheckoutPage() {
  // Guests can check out; an account is optional.
  const session = await auth();
  const { cart } = await resolveCart();

  if (!cart || cart.items.length === 0) {
    redirect('/cart');
  }

  const repos = createRepositories();
  const addresses = session?.user?.id
    ? await repos.address.findByUserId(session.user.id)
    : [];

  // Totals and line items are computed here (server) and handed to the
  // client component as plain numbers — the cart/checkout helpers depend on
  // `next/headers` and cannot be pulled into a client bundle.
  const { subtotal, shipping, unitPrices } = await calculateOrderTotals(cart);
  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const lines = cart.items.map((item) => ({
    id: item.id,
    name: item.variant.product.name,
    quantity: item.quantity,
    // Uses the same flash-sale-aware price the order will be charged at.
    lineTotal: unitPrices.get(item.variantId)! * item.quantity,
  }));

  return (
    <main>
      <Section spacing="md" className="border-b border-border bg-card">
        <Container>
          <Heading as="h1" size="lg" className="mb-2">
            Checkout
          </Heading>
          <Text variant="muted">
            <Link href="/cart" className="underline-offset-4 hover:underline">
              Back to cart
            </Link>
          </Text>
        </Container>
      </Section>

      <Section>
        <Container>
          <Grid cols={1} gap="lg" className="lg:grid-cols-[1fr_360px]">
            <CheckoutClient
              isGuest={!session?.user?.id}
              addresses={addresses}
              subtotal={subtotal}
              shipping={shipping}
              itemCount={itemCount}
              lines={lines}
            />
          </Grid>
        </Container>
      </Section>
    </main>
  );
}
