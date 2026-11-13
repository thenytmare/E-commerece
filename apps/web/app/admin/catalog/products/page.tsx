import { createRepositories, type RoleName } from '@repo/database';
import { requirePermission } from '@/lib/actions/auth';
import { hasPermission } from '@/lib/auth/permissions';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { ProductListClient } from './ProductListClient';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export const metadata = { title: 'Products | Admin' };

export default async function ProductsPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await requirePermission('products.read');
  const canWrite = hasPermission((session.user.roles as RoleName[] | undefined) ?? [], 'products.write');
  const repos = createRepositories();
  const resolvedSearchParams = await searchParams;
  
  const page = typeof resolvedSearchParams.page === 'string' ? parseInt(resolvedSearchParams.page, 10) : 1;
  const search = typeof resolvedSearchParams.search === 'string' ? resolvedSearchParams.search : undefined;
  const brandId = typeof resolvedSearchParams.brand === 'string' ? resolvedSearchParams.brand : undefined;
  const categoryId = typeof resolvedSearchParams.category === 'string' ? resolvedSearchParams.category : undefined;
  const statusFilter = typeof resolvedSearchParams.status === 'string' ? resolvedSearchParams.status : undefined;
  const featuredFilter = typeof resolvedSearchParams.featured === 'string' ? resolvedSearchParams.featured : undefined;

  // The Visible / Hidden tabs use ?visibility=. Older links used ?status=active
  // and ?status=inactive, so those still work.
  const visibilityParam = typeof resolvedSearchParams.visibility === 'string' ? resolvedSearchParams.visibility : undefined;
  const visibility: 'visible' | 'hidden' | undefined =
    visibilityParam === 'visible' || statusFilter === 'active'
      ? 'visible'
      : visibilityParam === 'hidden' || statusFilter === 'inactive'
        ? 'hidden'
        : undefined;
  // The Trash tab lists deleted products, which are always inactive, so the
  // visibility filter does not apply there.
  const isActive =
    statusFilter === 'archived' ? undefined : visibility === 'visible' ? true : visibility === 'hidden' ? false : undefined;
  const isFeatured = featuredFilter === 'true' ? true : featuredFilter === 'false' ? false : undefined;

  const sortKeyParam = typeof resolvedSearchParams.sort === 'string' ? resolvedSearchParams.sort : undefined;
  const sortDirection = resolvedSearchParams.dir === 'asc' ? 'asc' : 'desc';
  const sortKey = (['name', 'basePrice', 'createdAt', 'updatedAt'] as const).find(
    (k) => k === sortKeyParam
  );

  const productsData = await repos.product.adminFindMany({
    page,
    limit: 25,
    search,
    brandId,
    categoryId,
    isActive,
    isFeatured,
    status: statusFilter === 'draft' ? 'draft' : statusFilter === 'archived' ? 'archived' : undefined,
    sortKey,
    sortDirection,
  });

  // Filter options, tab counts and stock for the rows on this page.
  const [brands, categories, counts, stockByProduct] = await Promise.all([
    repos.brand.findAllActive(),
    repos.category.adminFindMany({ isActive: true, limit: 100 }),
    repos.product.getVisibilityCounts({ search, brandId, categoryId, isFeatured }),
    repos.product.getAvailableStockByProduct(productsData.items.map((product) => product.id)),
  ]);

  const initialData = {
    ...productsData,
    items: productsData.items.map((product) => ({
      id: product.id,
      name: product.name,
      slug: (product as { slug?: string }).slug ?? '',
      basePrice: Number(product.basePrice),
      isActive: product.isActive,
      isFeatured: product.isFeatured,
      availableStock: stockByProduct.get(product.id) ?? 0,
      status: (product as { status?: string }).status ?? (product.isActive ? 'active' : 'draft'),
      brand: product.brand,
      category: product.category,
      images: product.images.map((image) => ({
        id: image.id,
        url: image.url,
      })),
    })),
  };

  return (
    <AdminPage 
      title="Products"
      description="Manage your product catalog, pricing, and availability."
      actions={
        canWrite ? (
          <Link
            href="/admin/catalog/products/new"
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </Link>
        ) : null
      }
    >
      <ProductListClient
        initialData={initialData}
        initialSearch={search || ''}
        counts={counts}
        visibility={visibility ?? 'all'}
        sortKey={sortKey}
        sortDirection={sortDirection}
        filterOptions={{
          brands: brands.map(b => ({ id: b.id, name: b.name })),
          categories: categories.items.map(c => ({ id: c.id, name: c.name })),
        }}
      />
    </AdminPage>
  );
}