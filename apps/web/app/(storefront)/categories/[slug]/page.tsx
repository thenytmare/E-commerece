import { CatalogBrowser } from '@/components/catalog/catalog-browser';
import { Pagination } from '@/components/catalog/pagination';
import { ProductGrid } from '@/components/catalog/product-grid';
import { loadCatalogPage, SORT_OPTIONS, type CatalogSearchParams } from '@/lib/catalog';
import { getCachedCategoryBySlug } from '@/lib/catalog-cache';
import { Container, Heading, Section, Text } from '@repo/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<CatalogSearchParams>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCachedCategoryBySlug(slug);

  if (!category) {
    return { title: 'Category Not Found' };
  }

  return {
    title: category.name,
    description: `Shop ${category.name} at Prime Accessories Kenya — premium electronics delivered across Kenya.`,
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const query = await searchParams;

  const category = await getCachedCategoryBySlug(slug);
  if (!category) {
    notFound();
  }

  const { filters, catalog, categories, brands, activeBrandSlugs } = await loadCatalogPage(query, category.slug);
  const state = { q: filters.search, brands: activeBrandSlugs, sort: filters.sort };
  const basePath = `/categories/${category.slug}`;

  return (
    <main>
      <Section spacing="sm" className="border-b border-border bg-card">
        <Container>
          <Heading as="h1" size="lg">
            {category.name}
          </Heading>
          {category.description ? (
            <Text variant="muted" className="mt-2 max-w-2xl">
              {category.description}
            </Text>
          ) : null}
        </Container>
      </Section>

      <Section spacing="sm">
        <Container>
          <CatalogBrowser
            basePath={basePath}
            activeCategorySlug={category.slug}
            activeCategoryName={category.name}
            categories={categories}
            brands={brands}
            state={state}
            sortOptions={SORT_OPTIONS}
            total={catalog.total}
          >
            <div className="space-y-8">
              <ProductGrid
                products={catalog.items}
                emptyMessage={
                  filters.search || activeBrandSlugs.length > 0
                    ? 'No products match these filters. Try removing one.'
                    : `No products in ${category.name} yet.`
                }
              />
              <Pagination
                page={catalog.page}
                totalPages={catalog.totalPages}
                basePath={basePath}
                searchParams={{
                  q: filters.search,
                  brand: activeBrandSlugs.join(',') || undefined,
                  sort: filters.sort === 'newest' ? undefined : filters.sort,
                }}
              />
            </div>
          </CatalogBrowser>
        </Container>
      </Section>
    </main>
  );
}
