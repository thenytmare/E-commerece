import { createRepositories } from '@repo/database';
import { requirePermission } from '@/lib/actions/auth';
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
  await requirePermission('products.read');
  const repos = createRepositories();
  const resolvedSearchParams = await searchParams;
  
  const page = typeof resolvedSearchParams.page === 'string' ? parseInt(resolvedSearchParams.page, 10) : 1;
  const search = typeof resolvedSearchParams.search === 'string' ? resolvedSearchParams.search : undefined;

  const productsData = await repos.product.adminFindMany({
    page,
    limit: 10,
    search
  });

  // Prisma Decimal instances cannot cross the Server Component boundary. Keep
  // this list DTO intentionally small and composed of plain serializable values.
  const initialData = {
    ...productsData,
    items: productsData.items.map((product) => ({
      id: product.id,
      name: product.name,
      basePrice: Number(product.basePrice),
      isActive: product.isActive,
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
        <Link 
          href="/admin/catalog/products/new"
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </Link>
      }
    >
      <ProductListClient initialData={initialData} initialSearch={search || ''} />
    </AdminPage>
  );
}
