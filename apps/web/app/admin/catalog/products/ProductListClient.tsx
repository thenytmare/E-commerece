'use client';

import React, { useState, useEffect } from 'react';
import { DataTable, ColumnDef } from '@/components/admin/ui/DataTable';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import { PaginatedProducts, ProductListItem } from '@repo/database';
import Link from 'next/link';
import { Edit, Trash } from 'lucide-react';
import { deleteProductAction, toggleProductStatusAction } from '@/lib/actions/admin-products';
import { ConfirmationDialog } from '@/components/admin/ui/ConfirmationDialog';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export function ProductListClient({ initialData, initialSearch }: { initialData: PaginatedProducts, initialSearch: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (searchTerm) {
        params.set('search', searchTerm);
        params.set('page', '1');
      } else {
        params.delete('search');
      }
      router.push(`${pathname}?${params.toString()}`);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, pathname, router, searchParams]);

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleDelete = async () => {
    if (!isDeleting) return;
    const res = await deleteProductAction(isDeleting);
    if (res.success) {
      router.refresh(); // Reload data
    } else {
      alert(res.error || 'Failed to delete');
    }
    setIsDeleting(null);
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    await toggleProductStatusAction(id, !currentStatus);
    router.refresh();
  };

  const columns: ColumnDef<ProductListItem>[] = [
    {
      key: 'name',
      header: 'Product',
      cell: (item) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-muted overflow-hidden flex-shrink-0">
            {item.images?.[0]?.url ? (
              <img src={item.images[0].url} alt={item.name} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">No img</div>
            )}
          </div>
          <div>
            <p className="font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.brand?.name} • {item.category?.name}</p>
          </div>
        </div>
      ),
    },
    { 
      key: 'basePrice', 
      header: 'Price',
      cell: (item) => (
        <span className="font-medium">${Number(item.basePrice).toFixed(2)}</span>
      )
    },
    {
      key: 'isActive',
      header: 'Status',
      cell: (item) => (
        <button onClick={() => toggleStatus(item.id, item.isActive)}>
          <StatusBadge status={item.isActive ? 'success' : 'draft'} />
        </button>
      ),
    }
  ];

  return (
    <>
      <DataTable
        data={initialData.items}
        columns={columns}
        onSearch={setSearchTerm}
        page={initialData.page}
        totalPages={initialData.totalPages}
        onPageChange={handlePageChange}
        selectable
        rowActions={(item) => (
          <div className="flex items-center justify-end gap-2">
            <Link 
              href={`/admin/catalog/products/${item.id}`}
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
        title="Delete Product"
        description="Are you sure you want to delete this product? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setIsDeleting(null)}
      />
    </>
  );
}
