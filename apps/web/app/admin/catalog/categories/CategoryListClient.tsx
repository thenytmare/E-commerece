'use client';

import React, { useState } from 'react';
import { DataTable, ColumnDef } from '@/components/admin/ui/DataTable';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import { AdminCategoryListItem } from '@repo/database';
import Link from 'next/link';
import { Edit, Trash } from 'lucide-react';
import { deleteCategoryAction } from '@/lib/actions/admin-categories';
import { ConfirmationDialog } from '@/components/admin/ui/ConfirmationDialog';

export function CategoryListClient({ initialData = [] }: { initialData?: AdminCategoryListItem[] }) {
  const [data, setData] = useState<AdminCategoryListItem[]>(initialData || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!isDeleting) return;
    const res = await deleteCategoryAction(isDeleting);
    if (res.success) {
      setData(data.filter(c => c.id !== isDeleting));
    } else {
      alert(res.error || 'Failed to delete');
    }
    setIsDeleting(null);
  };

  const filteredData = data.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const columns: ColumnDef<AdminCategoryListItem>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (item) => (
        <div>
          <p className="font-medium">{item.name}</p>
          {item.parent && <p className="text-xs text-muted-foreground mt-0.5">↳ Under {item.parent.name}</p>}
        </div>
      ),
      sortable: true
    },
    { key: 'slug', header: 'Slug', sortable: true },
    {
      key: 'isActive',
      header: 'Status',
      cell: (item) => <StatusBadge status={item.isActive ? 'success' : 'draft'} />,
    },
    {
      key: '_count',
      header: 'Products',
      cell: (item) => <span className="text-muted-foreground">{item._count?.products || 0} products</span>,
    }
  ];

  return (
    <>
      <DataTable
        data={filteredData}
        columns={columns}
        onSearch={setSearchTerm}
        selectable
        rowActions={(item) => (
          <div className="flex items-center justify-end gap-2">
            <Link 
              href={`/admin/catalog/categories/${item.id}`}
              className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-muted"
            >
              <Edit className="h-4 w-4" />
            </Link>
            <button 
              onClick={() => setIsDeleting(item.id)}
              className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-muted"
            >
              <Trash className="h-4 w-4" />
            </button>
          </div>
        )}
      />

      <ConfirmationDialog
        isOpen={!!isDeleting}
        title="Delete Category"
        description="Are you sure you want to delete this category? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setIsDeleting(null)}
      />
    </>
  );
}
