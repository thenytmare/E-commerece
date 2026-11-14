import { CatalogBrowser } from '@/components/catalog/catalog-browser';
import { Pagination } from '@/components/catalog/pagination';
import { ProductGrid } from '@/components/catalog/product-grid';
import { loadCatalogPage, SORT_OPTIONS, type CatalogSearchParams } from '@/lib/catalog';
import { Container, Heading, Section } from '@repo/ui';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Products',
  description: 'Browse premium electronics — earbuds, smart watches, chargers, and more.',
};

interface ProductsPageProps {
  searchParams: Promise<CatalogSearchParams>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const { filters, catalog, categories, brands, activeBrandSlugs } = await loadCatalogPage(params);

  const state = { q: filters.search, brands: activeBrandSlugs, sort: filters.sort };

  return (
    <main>
      <Section spacing="sm" className="border-b border-border bg-card">
        <Container>
          <Heading as="h1" size="lg">
            All Products
          </Heading>
        </Container>
      </Section>

      <Section spacing="sm">
        <Container>
          <CatalogBrowser
            basePath="/products"
            categories={categories}
            brands={brands}
            state={state}
            sortOptions={SORT_OPTIONS}
            total={catalog.total}
          >
            <div className="space-y-8">
              <ProductGrid
                products={catalog.items}
                emptyMessage="No products match these filters. Try removing one, or clear them all."
              />
              <Pagination
                page={catalog.page}
                totalPages={catalog.totalPages}
                basePath="/products"
                searchParams={{
                  q: filters.search,
                  brand: activeBrandSlugs.join(',') || undefined,
                  sort: filters.sort === 'newest' ? undefined : filters.sort,
                  featured: params.featured,
                }}
              />
            </div>
          </CatalogBrowser>
        </Container>
      </Section>
    </main>
  );
}
