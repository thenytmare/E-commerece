import { ProductGrid } from '@/components/catalog/product-grid';
import { ProductImage } from '@/components/catalog/product-image';
import { BannerStrip } from '@/components/BannerStrip';
import { TrustStrip } from '@/components/trust-strip';
import { formatPrice } from '@/lib/format';
import { getHomepageSections } from '@/lib/homepage';
import { Button, Container, Heading, Section, Text } from '@repo/ui';
import Image from 'next/image';
import Link from 'next/link';
import { CategoryCards, MoreCategories } from '@/components/catalog/category-cards';
import { getCachedCategoryCards, getHomeProducts } from '@/lib/catalog-cache';

export default async function HomePage() {
  const sections = await getHomepageSections();

  const [categories, { featured, newArrivals, bestSellers }] = await Promise.all([
    sections.featuredCategories.enabled ? getCachedCategoryCards() : Promise.resolve([]),
    getHomeProducts({
      featured: sections.featuredProducts.enabled,
      newArrivals: sections.newArrivals.enabled,
      bestSellers: sections.bestSellers.enabled,
    }),
  ]);

  // Up to five big tiles: the categories ticked "Show on the homepage", in
  // sort order. Until any are ticked, the first five by sort order. Every
  // other category is listed as a small link underneath.
  const HOME_TILES = 5;
  const picked = categories.filter((category) => category.isFeatured);
  const homeTiles = (picked.length > 0 ? picked : categories).slice(0, HOME_TILES);
  const tileIds = new Set(homeTiles.map((category) => category.id));
  const otherCategories = categories.filter((category) => !tileIds.has(category.id));

  // What most shoppers actually see first when the hero has no admin-set
  // image: real stock, not a placeholder. Featured stock wins if curated;
  // new arrivals otherwise.
  const spotlight = (featured ?? newArrivals ?? [])[0];

  return (
    <main>
      {/* overflow-hidden on the hero: nothing in it may push the page wider than the screen. */}
      {sections.hero.enabled && (
        <Section spacing="lg" className="overflow-hidden border-b border-border bg-card">
          <Container>
            <div className="grid items-center gap-10 lg:grid-cols-[3fr_2fr] lg:gap-16">
              <div className="max-w-xl">
                <Heading as="h1" size="xl" className="mb-5">
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
              ) : spotlight ? (
                // One product, shown straight and square. Several tilted photos of
                // different styles looked like a scrapbook.
                <Link href={`/products/${spotlight.slug}`} className="group hidden justify-self-end lg:block lg:w-full lg:max-w-sm">
                  <div className="overflow-hidden rounded-2xl bg-muted">
                    <ProductImage src={spotlight.images[0]?.url} alt={spotlight.name} priority />
                  </div>
                  <div className="mt-3 flex items-baseline justify-between gap-4">
                    <span className="line-clamp-1 font-medium group-hover:underline">{spotlight.name}</span>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {formatPrice(spotlight.variants[0]?.price ?? spotlight.basePrice)}
                    </span>
                  </div>
                </Link>
              ) : null}
            </div>
          </Container>
        </Section>
      )}

      <TrustStrip />

      <BannerStrip position="homepage" />

      {sections.featuredCategories.enabled && categories.length > 0 && (
        <Section>
          <Container>
            <Heading size="lg" className="mb-6">
              Shop by Category
            </Heading>
            <CategoryCards categories={homeTiles} />
            <MoreCategories categories={otherCategories} />
            <div className="mt-8 flex justify-center">
              <Button size="lg" asChild className="w-full rounded-full sm:w-auto sm:px-10">
                <Link href="/products">See all products</Link>
              </Button>
            </div>
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
            <ProductGrid products={featured} emptyMessage="No featured products yet." />
          </Container>
        </Section>
      )}

      {sections.newArrivals.enabled && newArrivals && newArrivals.length > 0 && (
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
            <ProductGrid products={newArrivals} emptyMessage="" />
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
