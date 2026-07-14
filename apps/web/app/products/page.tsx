import { CatalogFilters } from '@/components/catalog/catalog-filters';
import { CategoryNav } from '@/components/catalog/category-nav';
import { Pagination } from '@/components/catalog/pagination';
import { ProductGrid } from '@/components/catalog/product-grid';
import { getCatalogRepos, resolveCatalogFilters, type CatalogSearchParams } from '@/lib/catalog';
import { Container, Heading, Section, Text } from '@repo/ui';
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
  const repos = getCatalogRepos();
  const filters = await resolveCatalogFilters(params);

  const [categories, brands, catalog] = await Promise.all([
    repos.category.findRootCategories(),
    repos.brand.findAllActive(),
    repos.product.findMany({
      categoryId: filters.categoryId,
      brandId: filters.brandId,
      search: filters.search,
      isFeatured: filters.isFeatured,
      page: filters.page,
    }),
  ]);

  const urlParams = {
    q: params.q,
    brand: params.brand,
    featured: params.featured,
  };

  return (
    <main>
      <Section spacing="md" className="border-b border-border bg-card">
        <Container>
          <Heading as="h1" size="lg" className="mb-2">
            All Products
          </Heading>
          <Text variant="muted">
            {catalog.total} product{catalog.total === 1 ? '' : 's'} available
          </Text>
        </Container>
      </Section>

      <Section>
        <Container className="space-y-8">
          <CategoryNav categories={categories} activeSlug={filters.category?.slug} />
          <CatalogFilters
            search={filters.search}
            brands={brands}
            activeBrandSlug={filters.brand?.slug}
          />
          <ProductGrid products={catalog.items} />
          <Pagination
            page={catalog.page}
            totalPages={catalog.totalPages}
            basePath="/products"
            searchParams={urlParams}
          />
        </Container>
      </Section>
    </main>
  );
}
