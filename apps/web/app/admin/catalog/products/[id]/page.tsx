import { createRepositories } from '@repo/database';
import { requirePermission } from '@/lib/actions/auth';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { ProductFormClient } from './ProductFormClient';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { toProductFormData } from '@/lib/admin/catalog-dtos';

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const repos = createRepositories();
  const resolvedParams = await params;
  const isNew = resolvedParams.id === 'new';
  await requirePermission(isNew ? 'products.write' : 'products.read');
  
  const product = isNew ? null : await repos.product.findById(resolvedParams.id, true);
  
  if (!isNew && !product) {
    notFound();
  }

  // Get options for dropdowns
  const [categories, brands] = await Promise.all([
    repos.category.adminFindMany().then(r => r.items),
    repos.brand.findAllActive()
  ]);

  return (
    <AdminPage 
      title={isNew ? 'Create Product' : `Edit Product: ${product?.name}`}
      actions={
        <Link 
          href="/admin/catalog/products"
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border border-border bg-background text-foreground rounded-md hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      }
    >
      <div className="max-w-4xl">
        <ProductFormClient 
          initialData={toProductFormData(product)} 
          categories={categories}
          brands={brands}
        />
      </div>
    </AdminPage>
  );
}
