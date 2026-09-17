import { ProductGrid } from '@/components/catalog/product-grid';
import { ProductImage } from '@/components/catalog/product-image';
import { BannerStrip } from '@/components/BannerStrip';
import { getCatalogRepos } from '@/lib/catalog';
import { getHomepageSections } from '@/lib/homepage';
import { Button, Container, Grid, Heading, Section, Text } from '@repo/ui';
import Image from 'next/image';
import Link from 'next/link';

export default async function HomePage() {
  const repos = getCatalogRepos();
  const sections = await getHomepageSections();

  const [categories, featured, newArrivals, bestSellers] = await Promise.all([
    sections.featuredCategories.enabled ? repos.category.findRootCategories() : Promise.resolve([]),
    sections.featuredProducts.enabled
      ? repos.product.findMany({ isFeatured: true, isActive: true, limit: 4 })
      : Promise.resolve(null),
    sections.newArrivals.enabled
      ? repos.product.findMany({ isActive: true, limit: 4 })
      : Promise.resolve(null),
    sections.bestSellers.enabled ? repos.product.findBestSelling(4) : Promise.resolve(null),
  ]);

  // What most shoppers actually see first when the hero has no admin-set
  // image: real stock, not a placeholder. Featured stock wins if curated;
  // new arrivals otherwise.
  const heroProducts = (featured?.items ?? newArrivals?.items ?? []).slice(0, 3);

  return (
    <main>
      {sections.hero.enabled && (
        <Section spacing="lg" className="border-b border-border bg-card">
          <Container>
            <div className="grid items-center gap-10 lg:grid-cols-[3fr_2fr] lg:gap-16">
              <div className="max-w-xl">
                <Heading as="h1" size="2xl" className="mb-5">
                  {sections.hero.title}
                </Heading>
                <Text variant="lead" className="mb-8 max-w-md">
                  {sections.hero.subtitle}
                </Text>
                <div className="flex flex-wrap items-center gap-4">
                  <Button size="lg" asChild>
                    <Link href={sections.hero.ctaLink || '/products'}>
                      {sections.hero.ctaText || 'Shop Now'}
                    </Link>
                  </Button>
                  <Button variant="outline" size="lg" asChild>
                    <Link href="/products?featured=true">Featured Deals</Link>
                  </Button>
                </div>
              </div>

              {sections.hero.imageUrl ? (
                <div className="relative hidden aspect-[4/3] overflow-hidden rounded-lg lg:block">
                  <Image
                    src={sections.hero.imageUrl}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 0px, 40vw"
                    className="object-cover"
                    priority
                  />
                </div>
              ) : heroProducts.length > 0 ? (
                <div className="relative hidden h-80 lg:block" aria-hidden="true">
                  <div className="absolute inset-0 rounded-lg bg-primary/10" />
                  {heroProducts.map((product, index) => {
                    const offsets = [
                      'left-6 top-4 w-40 rotate-[-4deg]',
                      'left-40 top-16 w-44 rotate-[3deg]',
                      'left-[15.5rem] top-2 w-36 rotate-[-2deg]',
                    ];
                    return (
                      <div
                        key={product.id}
                        className={`absolute overflow-hidden rounded-lg border border-border shadow-elevated ${offsets[index]}`}
                      >
                        <ProductImage
                          src={product.images[0]?.url}
                          alt={product.name}
                          priority={index === 0}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </Container>
        </Section>
      )}

      <BannerStrip position="homepage" />

      {sections.featuredCategories.enabled && categories.length > 0 && (
        <Section>
          <Container>
            <Heading size="lg" className="mb-6">
              Shop by Category
            </Heading>
            {/* CategoryNav's pill-filter pattern belongs on listing pages where it
                tracks an active category; here it only duplicated the card grid
                below with the same destinations, so this section keeps one. */}
            <Grid cols={4} gap="md">
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
      )}

      {sections.featuredProducts.enabled && featured && (
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
      )}

      {sections.newArrivals.enabled && newArrivals && newArrivals.items.length > 0 && (
        <Section>
          <Container>
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <Heading size="lg" className="mb-2">
                  New Arrivals
                </Heading>
                <Text variant="muted">The latest additions to our catalog</Text>
              </div>
              <Button variant="outline" asChild>
                <Link href="/products">View all</Link>
              </Button>
            </div>
            <ProductGrid products={newArrivals.items} emptyMessage="" />
          </Container>
        </Section>
      )}

      {sections.bestSellers.enabled && bestSellers && bestSellers.length > 0 && (
        <Section className="bg-muted/30">
          <Container>
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <Heading size="lg" className="mb-2">
                  Best Sellers
                </Heading>
                <Text variant="muted">Our customers&apos; most-purchased picks</Text>
              </div>
              <Button variant="outline" asChild>
                <Link href="/products">View all</Link>
              </Button>
            </div>
            <ProductGrid products={bestSellers} emptyMessage="" />
          </Container>
        </Section>
      )}
    </main>
  );
}
