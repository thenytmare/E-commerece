import { CategoryNav } from '@/components/catalog/category-nav';
import { ProductGrid } from '@/components/catalog/product-grid';
import { getCatalogRepos } from '@/lib/catalog';
import { Button, Container, Grid, Heading, Section, Text } from '@repo/ui';
import Link from 'next/link';

export default async function HomePage() {
  const repos = getCatalogRepos();

  const [categories, featured] = await Promise.all([
    repos.category.findRootCategories(),
    repos.product.findMany({ isFeatured: true, limit: 4 }),
  ]);

  return (
    <main>
      <Section spacing="lg" className="border-b border-border bg-card">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <Heading as="h1" size="2xl" className="mb-6">
              Premium Electronics for Kenya
            </Heading>
            <Text variant="lead" className="mb-8">
              Discover earbuds, smart watches, chargers, and power banks from top brands — with
              fast delivery across Kenya.
            </Text>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/products">Shop All Products</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/products?featured=true">Featured Deals</Link>
              </Button>
            </div>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <Heading size="lg" className="mb-6">
            Shop by Category
          </Heading>
          <CategoryNav categories={categories} />
          <Grid cols={4} gap="md" className="mt-8">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className="group rounded-xl border border-border bg-card p-6 text-center shadow-soft transition-shadow hover:shadow-md"
              >
                <Heading as="h3" size="xs" className="group-hover:text-primary">
                  {category.name}
                </Heading>
              </Link>
            ))}
          </Grid>
        </Container>
      </Section>

      <Section className="bg-muted/30">
        <Container>
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <Heading size="lg" className="mb-2">
                Featured Products
              </Heading>
              <Text variant="muted">Hand-picked deals on premium gear</Text>
            </div>
            <Button variant="outline" asChild>
              <Link href="/products">View all</Link>
            </Button>
          </div>
          <ProductGrid products={featured.items} emptyMessage="No featured products yet." />
        </Container>
      </Section>
    </main>
  );
}
