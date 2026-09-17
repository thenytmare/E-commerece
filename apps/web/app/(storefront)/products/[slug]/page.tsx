import { ProductGrid } from '@/components/catalog/product-grid';
import { ProductDetailView } from '@/components/catalog/ProductDetailView';
import { ProductJsonLd } from '@/components/catalog/ProductJsonLd';
import { StarRating } from '@/components/catalog/StarRating';
import { ProductReviews } from '@/components/catalog/ProductReviews';
import { WishlistButton } from '@/components/catalog/WishlistButton';
import { auth } from '@/auth';
import { getCatalogRepos } from '@/lib/catalog';
import { getStoreSettings } from '@/lib/store';
import { toClientProductDetail } from '@/lib/catalog-dtos';
import { Badge, Container, Heading, Section, Text } from '@repo/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const repos = getCatalogRepos();
  const product = await repos.product.findPublicBySlug(slug);

  if (!product) {
    return { title: 'Product Not Found' };
  }

  const description = product.seoDescription ?? product.shortDescription ?? undefined;
  const image = product.images[0]?.url;

  return {
    title: product.seoTitle ?? product.name,
    description,
    // Canonical + OG image so a shared product link previews properly and
    // filtered variants of the same page don't compete in search results.
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: 'website',
      title: product.seoTitle ?? product.name,
      description,
      url: `/products/${product.slug}`,
      images: image ? [{ url: image, alt: product.name }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: product.seoTitle ?? product.name,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const repos = getCatalogRepos();
  const [product, settings] = await Promise.all([
    repos.product.findPublicBySlug(slug),
    getStoreSettings(),
  ]);

  if (!product) {
    notFound();
  }

  // An active flash sale overrides the variant price for the duration of
  // its window (see Admin → Marketing → Flash Sales).
  const flashSale = await repos.flashSale.getActiveForProduct(product.id);

  // Related products: same brand + same category, excluding current
  const related = await repos.product.findMany({
    brandId: product.brandId,
    categoryId: product.categoryId,
    isActive: true,
    limit: 4,
  });
  const relatedProducts = related.items.filter(p => p.id !== product.id).slice(0, 4);

  // Structured-data inputs, taken from the same values the page renders so the
  // markup can't drift from what a shopper actually sees.
  const defaultVariant = product.variants[0];
  const listedPrice = defaultVariant ? Number(defaultVariant.price) : Number(product.basePrice);
  const jsonLdPrice = flashSale
    ? Math.min(listedPrice, Number(flashSale.salePrice))
    : listedPrice;
  const inStock = product.variants.some(
    (variant) => (variant.inventory?.quantity ?? 0) - (variant.inventory?.reserved ?? 0) > 0
  );
  const ratingSummary = await repos.review.getRatingSummary(product.id);

  // Wishlist state for the signed-in shopper, so the heart renders correctly
  // on first paint instead of flickering after hydration.
  const session = await auth();
  const isSaved = session?.user?.id
    ? await repos.wishlist.has(session.user.id, product.id)
    : false;

  return (
    <main>
      <ProductJsonLd
        name={product.name}
        description={product.seoDescription ?? product.shortDescription}
        sku={defaultVariant?.sku}
        brand={product.brand.name}
        category={product.category.name}
        images={product.images.map((image) => image.url)}
        price={jsonLdPrice}
        inStock={inStock}
        url={`/products/${product.slug}`}
        ratingValue={ratingSummary.average}
        reviewCount={ratingSummary.count}
      />
      <Section spacing="md" className="border-b border-border">
        <Container>
          {/* Breadcrumb */}
          <nav className="mb-4 text-sm text-muted-foreground" aria-label="Breadcrumb">
            <Link href="/products" className="hover:text-foreground">
              Products
            </Link>
            <span className="mx-2">/</span>
            <Link href={`/categories/${product.category.slug}`} className="hover:text-foreground">
              {product.category.name}
            </Link>
            <span className="mx-2">/</span>
            <span className="text-foreground">{product.name}</span>
          </nav>

          {/*
            Below `lg` these pieces are flex items so `order` can put the
            photo first: a shopper on a phone should see what the product
            looks like before scrolling past a paragraph of copy to find it.
            At `lg` and up order resets to the original, deliberate desktop
            sequence (title block, then the image/actions row).
          */}
          <div className="flex flex-col">
            {/* Brand name on top */}
            <Text variant="muted" className="order-2 mb-3 text-xs font-medium text-primary lg:order-none">
              {product.brand.name}
            </Text>

            {/* Product name + short description + badges */}
            <div className="order-2 mb-8 space-y-5 lg:order-none">
              <div>
                <Heading as="h1" size="lg">
                  {product.name}
                </Heading>
                {product.shortDescription && (
                  <Text variant="lead" className="mt-2">
                    {product.shortDescription}
                  </Text>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{product.brand.name}</Badge>
                <Badge variant="outline">{product.category.name}</Badge>
                {product.isFeatured && <Badge>Featured</Badge>}
              </div>

              {ratingSummary.count > 0 && ratingSummary.average !== null ? (
                <a
                  href="#reviews"
                  className="mt-3 inline-flex items-center gap-2 text-sm hover:underline"
                >
                  <StarRating value={ratingSummary.average} />
                  <span className="text-muted-foreground">
                    {ratingSummary.average.toFixed(1)} ({ratingSummary.count} review
                    {ratingSummary.count === 1 ? '' : 's'})
                  </span>
                </a>
              ) : null}
            </div>

            {/* Gallery + actions (shared variant selection) */}
            <ProductDetailView
              product={toClientProductDetail(product)}
              whatsappNumber={settings.whatsappNumber}
              flashSalePrice={flashSale ? Number(flashSale.salePrice) : null}
              flashSaleEndsAt={flashSale ? flashSale.endsAt.toISOString() : null}
              className="order-1 lg:order-none"
            />

            <WishlistButton
              productId={product.id}
              productSlug={product.slug}
              initialSaved={isSaved}
              showLabel
              className="order-3 mt-4 lg:order-none"
            />
          </div>
        </Container>
      </Section>

      {/* Features */}
      {product.features.length > 0 && (
        <Section className="bg-muted/30">
          <Container>
            <Heading size="md" className="mb-4">
              Key Features
            </Heading>
            <ul className="grid gap-3 sm:grid-cols-2">
              {product.features.map((feature) => (
                <li key={feature.id} className="flex items-start gap-2 text-sm">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                  {feature.text}
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      )}

      {/* Specifications */}
      {product.specs.length > 0 && (
        <Section>
          <Container>
            <Heading size="md" className="mb-6">
              Specifications
            </Heading>
            <div className="grid gap-6 md:grid-cols-2">
              {Object.entries(
                product.specs.reduce<Record<string, typeof product.specs>>((groups, spec) => {
                  const group = groups[spec.groupName] ?? [];
                  group.push(spec);
                  groups[spec.groupName] = group;
                  return groups;
                }, {})
              ).map(([groupName, specs]) => (
                <div key={groupName} className="rounded-xl border border-border bg-card p-6">
                  <Heading as="h3" size="xs" className="mb-4">
                    {groupName}
                  </Heading>
                  <dl className="space-y-3">
                    {specs.map((spec) => (
                      <div key={spec.id} className="flex justify-between gap-4 text-sm">
                        <dt className="text-muted-foreground">{spec.key}</dt>
                        <dd className="text-right font-medium">{spec.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </Container>
        </Section>
      )}

      {/* Box Contents */}
      {product.boxContents.length > 0 && (
        <Section className="bg-muted/30">
          <Container>
            <Heading size="md" className="mb-4">
              In the Box
            </Heading>
            <ul className="grid gap-2 sm:grid-cols-2">
              {product.boxContents.map((item) => (
                <li key={item.id} className="text-sm text-muted-foreground">
                  • {item.item}
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      )}

      <div id="reviews">
        <ProductReviews productId={product.id} productSlug={product.slug} />
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <Section>
          <Container>
            <Heading size="md" className="mb-6">
              You May Also Like
            </Heading>
            <ProductGrid products={relatedProducts} emptyMessage="" />
          </Container>
        </Section>
      )}
    </main>
  );
}