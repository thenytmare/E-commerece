import { CheckoutForm } from '@/components/checkout/checkout-form';
import { CheckoutSummary } from '@/components/checkout/checkout-summary';
import { requireAuth } from '@/lib/actions/auth';
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
  const session = await requireAuth('/login?callbackUrl=/checkout');
  const { cart } = await resolveCart();

  if (!cart || cart.items.length === 0) {
    redirect('/cart');
  }

  const repos = createRepositories();
  const addresses = await repos.address.findByUserId(session.user.id);

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
            <CheckoutForm addresses={addresses} />
            <CheckoutSummary cart={cart} />
          </Grid>
        </Container>
      </Section>
    </main>
  );
}
