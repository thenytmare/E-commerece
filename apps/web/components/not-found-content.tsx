import { SearchInput } from '@/components/SearchInput';
import { getCachedCategoryCards } from '@/lib/catalog-cache';
import { Button, Container, Heading, Text } from '@repo/ui';
import Link from 'next/link';

/**
 * What a shopper sees when a page or product does not exist: a plain
 * explanation, a search box, and ways back into the shop. Follows light and
 * dark like every other page.
 */
export async function NotFoundContent() {
  // A failure here must not break the not-found page itself.
  const categories = await getCachedCategoryCards()
    .then((cards) => cards.slice(0, 6))
    .catch(() => []);

  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto max-w-xl text-center">
        <p className="text-sm font-semibold text-primary">Page not found</p>
        <Heading as="h1" size="lg" className="mt-2">
          We couldn&apos;t find that page
        </Heading>
        <Text variant="muted" className="mt-3">
          The link may be old, or the product may no longer be sold. Try a search, or carry on shopping.
        </Text>

        <div className="mx-auto mt-8 max-w-md">
          <SearchInput className="max-w-none" />
        </div>

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild className="h-11">
            <Link href="/products">Browse all products</Link>
          </Button>
          <Button asChild variant="outline" className="h-11">
            <Link href="/">Go to the home page</Link>
          </Button>
        </div>

        {categories.length > 0 && (
          <nav aria-label="Popular categories" className="mt-10">
            <h2 className="text-sm font-medium text-muted-foreground">Popular categories</h2>
            <ul className="mt-3 flex flex-wrap justify-center gap-2">
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/categories/${category.slug}`}
                    className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm text-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </Container>
  );
}
