import { ProductImage } from '@/components/catalog/product-image';
import { ProductVariantPicker } from '@/components/catalog/product-variant-picker';
import { getCatalogRepos } from '@/lib/catalog';
import { Badge, Container, Grid, Heading, Section, Text } from '@repo/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const repos = getCatalogRepos();
  const product = await repos.product.findBySlug(slug);

  if (!product) {
    return { title: 'Product Not Found' };
  }

  return {
    title: product.seoTitle ?? product.name,
    description: product.seoDescription ?? product.shortDescription ?? undefined,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const repos = getCatalogRepos();
  const product = await repos.product.findBySlug(slug);

  if (!product) {
    notFound();
  }

  const featuredImage = product.images.find((image) => image.isFeatured) ?? product.images[0];
  const specsByGroup = product.specs.reduce<Record<string, typeof product.specs>>((groups, spec) => {
    const group = groups[spec.groupName] ?? [];
    group.push(spec);
    groups[spec.groupName] = group;
    return groups;
  }, {});

  return (
    <main>
      <Section spacing="md" className="border-b border-border">
        <Container>
          <nav className="mb-6 text-sm text-muted-foreground" aria-label="Breadcrumb">
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

          <Grid cols={2} gap="lg" className="lg:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <ProductImage
                src={featuredImage?.url}
                alt={featuredImage?.alt ?? product.name}
                priority
                className="aspect-square"
              />
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{product.brand.name}</Badge>
                  <Badge variant="outline">{product.category.name}</Badge>
                  {product.isFeatured ? <Badge>Featured</Badge> : null}
                </div>
                <Heading as="h1" size="lg">
                  {product.name}
                </Heading>
                {product.shortDescription ? (
                  <Text variant="lead">{product.shortDescription}</Text>
                ) : null}
              </div>

              <ProductVariantPicker product={product} />
            </div>
          </Grid>
        </Container>
      </Section>

      {product.description ? (
        <Section>
          <Container>
            <Heading size="md" className="mb-4">
              Description
            </Heading>
            <Text className="max-w-3xl whitespace-pre-line">{product.description}</Text>
          </Container>
        </Section>
      ) : null}

      {product.features.length > 0 ? (
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
      ) : null}

      {Object.keys(specsByGroup).length > 0 ? (
        <Section>
          <Container>
            <Heading size="md" className="mb-6">
              Specifications
            </Heading>
            <div className="grid gap-6 md:grid-cols-2">
              {Object.entries(specsByGroup).map(([groupName, specs]) => (
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
      ) : null}

      {product.boxContents.length > 0 ? (
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
      ) : null}
    </main>
  );
}
