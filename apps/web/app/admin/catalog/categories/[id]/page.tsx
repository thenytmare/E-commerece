import { createRepositories } from '@repo/database';
import { requireAdmin } from '@/lib/actions/auth';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { CategoryFormClient } from './CategoryFormClient';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function CategoryEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const repos = createRepositories();
  const resolvedParams = await params;
  const isNew = resolvedParams.id === 'new';
  
  const category = isNew ? null : await repos.category.findById(resolvedParams.id);
  
  if (!isNew && !category) {
    notFound();
  }

  // Get all categories for parent selection (exclude self if editing)
  const allCategories = await repos.category.adminFindMany();
  const availableParents = allCategories.filter(c => c.id !== category?.id);

  return (
    <AdminPage 
      title={isNew ? 'Create Category' : `Edit Category: ${category?.name}`}
      actions={
        <Link 
          href="/admin/catalog/categories"
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border border-border bg-background text-foreground rounded-md hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      }
    >
      <div className="max-w-3xl">
        <CategoryFormClient 
          initialData={category} 
          availableParents={availableParents} 
        />
      </div>
    </AdminPage>
  );
}
