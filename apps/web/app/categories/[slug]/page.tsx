import { CategoryNav } from '@/components/catalog/category-nav';
import { CatalogFilters } from '@/components/catalog/catalog-filters';
import { Pagination } from '@/components/catalog/pagination';
import { ProductGrid } from '@/components/catalog/product-grid';
import { getCatalogRepos } from '@/lib/catalog';
import { Container, Heading, Section, Text } from '@repo/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; brand?: string; page?: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const repos = getCatalogRepos();
  const category = await repos.category.findBySlug(slug);

  if (!category) {
    return { title: 'Category Not Found' };
  }

  return {
    title: category.name,
    description: `Shop ${category.name} at TechVault — premium electronics delivered across Kenya.`,
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const repos = getCatalogRepos();

  const category = await repos.category.findBySlug(slug);
  if (!category) {
    notFound();
  }

  const page = Math.max(1, Number(query.page) || 1);

  const [categories, brands, catalog] = await Promise.all([
    repos.category.findRootCategories(),
    repos.brand.findAllActive(),
    repos.product.findMany({
      categoryId: category.id,
      brandId: query.brand
        ? (await repos.brand.findBySlug(query.brand))?.id
        : undefined,
      search: query.q?.trim() || undefined,
      page,
    }),
  ]);

  const activeBrand = query.brand
    ? brands.find((brand) => brand.slug === query.brand)
    : undefined;

  return (
    <main>
      <Section spacing="md" className="border-b border-border bg-card">
        <Container>
          <Heading as="h1" size="lg" className="mb-2">
            {category.name}
          </Heading>
          <Text variant="muted">
            {catalog.total} product{catalog.total === 1 ? '' : 's'} in this category
          </Text>
        </Container>
      </Section>

      <Section>
        <Container className="space-y-8">
          <CategoryNav categories={categories} activeSlug={category.slug} />
          <CatalogFilters
            search={query.q}
            brands={brands}
            activeBrandSlug={activeBrand?.slug}
            basePath={`/categories/${category.slug}`}
          />
          <ProductGrid
            products={catalog.items}
            emptyMessage={`No products in ${category.name} yet.`}
          />
          <Pagination
            page={catalog.page}
            totalPages={catalog.totalPages}
            basePath={`/categories/${category.slug}`}
            searchParams={{ q: query.q, brand: query.brand }}
          />
        </Container>
      </Section>
    </main>
  );
}
