import { createRepositories } from '@repo/database';
import { requireAdmin } from '@/lib/actions/auth';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { CategoryListClient } from './CategoryListClient';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export const metadata = { title: 'Categories | Admin' };

export default async function CategoriesPage() {
  await requireAdmin();
  const repos = createRepositories();
  const categories = await repos.category.adminFindMany();

  return (
    <AdminPage 
      title="Categories"
      description="Manage product categories and taxonomy."
      actions={
        <Link 
          href="/admin/catalog/categories/new"
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Category
        </Link>
      }
    >
      <CategoryListClient initialData={categories} />
    </AdminPage>
  );
}
