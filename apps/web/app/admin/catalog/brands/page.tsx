import { createRepositories, type RoleName } from '@repo/database';
import { requirePermission } from '@/lib/actions/auth';
import { hasPermission } from '@/lib/auth/permissions';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { BrandListClient } from './BrandListClient';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export const metadata = { title: 'Brands | Admin' };

export default async function BrandsPage() {
  const session = await requirePermission('brands.read');
  const canWrite = hasPermission((session.user.roles as RoleName[] | undefined) ?? [], 'brands.write');
  // Both sets are fetched so the client's Active/Trash toggle has data for
  // either tab. Previously only active rows were loaded, so "Trash" listed the
  // same active brands with a Restore button attached, and an archived brand
  // could never be found or restored through the UI.
  const repos = createRepositories();
  const [{ items: active }, { items: archived }] = await Promise.all([
    repos.brand.adminFindMany({ isDeleted: false }),
    repos.brand.adminFindMany({ isDeleted: true }),
  ]);
  const initialData = [...active, ...archived].map((brand) => ({
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    logoUrl: brand.logoUrl,
    isActive: brand.isActive,
    isDeleted: brand.deletedAt !== null,
    productCount: brand._count.products,
  }));

  return (
    <AdminPage
      title="Brands"
      description="Manage product brands, identity, and SEO."
      actions={
        canWrite ? (
          <Link
            href="/admin/catalog/brands/new"
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Brand
          </Link>
        ) : null
      }
    >
      <BrandListClient initialData={initialData} />
    </AdminPage>
  );
}