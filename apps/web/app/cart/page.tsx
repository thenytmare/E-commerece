import { CartItemRow } from '@/components/cart/cart-item-row';
import { CartSummary } from '@/components/cart/cart-summary';
import { resolveCart } from '@/lib/cart';
import { Button, Container, Grid, Heading, Section, Text } from '@repo/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Cart',
  description: 'Review items in your TechVault shopping cart.',
};

export default async function CartPage() {
  const { cart } = await resolveCart();

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
          {!cart || cart.items.length === 0 ? (
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
                  <CartItemRow key={item.id} item={item} />
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
