import { requireAuth } from '@/lib/actions/auth';
import { createRepositories } from '@repo/database';
import { Button, Container, Heading, Section, Text } from '@repo/ui';
import { ProductImage } from '@/components/catalog/product-image';
import { WishlistButton } from '@/components/catalog/WishlistButton';
import { formatPrice } from '@/lib/format';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Saved items',
  description: 'Products you have saved for later.',
};

export default async function WishlistPage() {
  const session = await requireAuth('/login?callbackUrl=/account/wishlist');
  const items = await createRepositories().wishlist.listForUser(session.user.id);

  return (
    <main>
      <Section spacing="md" className="border-b border-border bg-card">
        <Container>
          <Heading as="h1" size="lg" className="mb-2">
            Saved items
          </Heading>
          <Text variant="muted">
            {items.length === 0
              ? 'Nothing saved yet.'
              : `${items.length} item${items.length === 1 ? '' : 's'} saved for later.`}
          </Text>
        </Container>
      </Section>

      <Section>
        <Container>
          {items.length === 0 ? (
            <div className="mx-auto max-w-md rounded-xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
              <Heading as="h2" size="sm" className="mb-3">
                No saved items
              </Heading>
              <Text variant="muted" className="mb-6">
                Tap the heart on any product to keep it here for later.
              </Text>
              <Button asChild>
                <Link href="/products">Browse products</Link>
              </Button>
            </div>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => {
                const image = item.product.images[0];
                const variant = item.product.variants[0];
                const price = variant ? Number(variant.price) : Number(item.product.basePrice);

                return (
                  <li
                    key={item.id}
                    className="flex flex-col overflow-hidden rounded-xl border border-border bg-card"
                  >
                    <Link href={`/products/${item.product.slug}`} className="block">
                      <ProductImage
                        src={image?.url}
                        alt={image?.alt ?? item.product.name}
                        className="aspect-square"
                      />
                    </Link>
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <Text variant="muted" className="text-xs font-medium text-primary">
                        {item.product.brand?.name}
                      </Text>
                      <Link
                        href={`/products/${item.product.slug}`}
                        className="font-medium leading-snug hover:text-primary"
                      >
                        {item.product.name}
                      </Link>
                      <Text className="font-semibold">{formatPrice(price)}</Text>

                      <div className="mt-auto pt-2">
                        <WishlistButton
                          productId={item.productId}
                          productSlug={item.product.slug}
                          variantId={item.variantId}
                          initialSaved
                          showLabel
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Container>
      </Section>
    </main>
  );
}
