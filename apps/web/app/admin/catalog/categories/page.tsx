import { createRepositories, type RoleName } from '@repo/database';
import { requirePermission } from '@/lib/actions/auth';
import { hasPermission } from '@/lib/auth/permissions';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { CategoryListClient } from './CategoryListClient';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export const metadata = { title: 'Categories | Admin' };

export default async function CategoriesPage() {
  const session = await requirePermission('categories.read');
  const canWrite = hasPermission((session.user.roles as RoleName[] | undefined) ?? [], 'categories.write');
  const repos = createRepositories();
  
  try {
    // Both sets are fetched so the client's Active/Trash toggle has data for
    // either tab. Previously only active rows were loaded, so "Trash" showed
    // the same active categories with a Restore button attached — and an
    // archived category could never be found or restored through the UI.
    const [{ items: active }, { items: archived }] = await Promise.all([
      repos.category.adminFindMany({ isDeleted: false }),
      repos.category.adminFindMany({ isDeleted: true }),
    ]);
    const categories = [...active, ...archived];
    
    return (
      <AdminPage 
        title="Categories"
        description="Manage product categories and taxonomy."
        actions={
          canWrite ? (
            <Link
              href="/admin/catalog/categories/new"
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Category
            </Link>
          ) : null
        }
      >
        <CategoryListClient initialData={categories || []} />
      </AdminPage>
    );
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return (
      <AdminPage 
        title="Categories"
        description="Manage product categories and taxonomy."
        actions={
          canWrite ? (
            <Link
              href="/admin/catalog/categories/new"
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Category
            </Link>
          ) : null
        }
      >
        <CategoryListClient initialData={[]} />
      </AdminPage>
    );
  }
}
