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

  const isActive = statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined;
  const isFeatured = featuredFilter === 'true' ? true : featuredFilter === 'false' ? false : undefined;

  const sortKeyParam = typeof resolvedSearchParams.sort === 'string' ? resolvedSearchParams.sort : undefined;
  const sortDirection = resolvedSearchParams.dir === 'asc' ? 'asc' : 'desc';
  const sortKey = (['name', 'basePrice', 'createdAt', 'updatedAt'] as const).find(
    (k) => k === sortKeyParam
  );

  const productsData = await repos.product.adminFindMany({
    page,
    limit: 10,
    search,
    brandId,
    categoryId,
    isActive,
    isFeatured,
    status: statusFilter === 'draft' ? 'draft' : statusFilter === 'archived' ? 'archived' : undefined,
    sortKey,
    sortDirection,
  });

  // Get filter options
  const [brands, categories] = await Promise.all([
    repos.brand.findAllActive(),
    repos.category.adminFindMany({ isActive: true, limit: 100 }),
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