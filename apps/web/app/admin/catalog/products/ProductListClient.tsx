'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DataTable, ColumnDef } from '@/components/admin/ui/DataTable';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import Link from 'next/link';
import Image from 'next/image';
import { Edit, Trash, Eye, CheckCircle, XCircle, Star, RotateCcw } from 'lucide-react';
import { deleteProductAction, restoreProductAction, toggleProductStatusAction, bulkActionProducts } from '@/lib/actions/admin-products';
import { ConfirmationDialog } from '@/components/admin/ui/ConfirmationDialog';
import { useToast } from '@/components/ui/toast';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { formatPrice } from '@/lib/format';

type ProductListItem = {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  isActive: boolean;
  isFeatured: boolean;
  status: string;
  brand: { name: string; slug: string } | null;
  category: { name: string; slug: string } | null;
  images: { id: string; url: string }[];
};

type PaginatedProducts = {
  items: ProductListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type FilterOptions = {
  brands: { id: string; name: string }[];
  categories: { id: string; name: string }[];
};

export function ProductListClient({
  initialData,
  initialSearch,
  filterOptions,
  sortKey,
  sortDirection,
}: {
  initialData: PaginatedProducts;
  initialSearch: string;
  filterOptions: FilterOptions;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { toast } = useToast();
  const { can } = usePermissions();
  const canWrite = can('products.write');
  const canDelete = can('products.delete');

  const [restoringId, setRestoringId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState<{ action: string; ids: string[] } | null>(null);

  // Filters
  const brandFilter = searchParams.get('brand') ?? '';
  const categoryFilter = searchParams.get('category') ?? '';
  const statusFilter = searchParams.get('status') ?? '';
  const featuredFilter = searchParams.get('featured') ?? '';

  // "archived" is how the repository already expresses soft-deleted products;
  // restore and permanent-delete were fully implemented server-side but had no
  // way to be reached from this page.
  const viewMode = statusFilter === 'archived' ? 'deleted' : 'active';

  const pushParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      params.set('page', '1');
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    const timer = setTimeout(() => pushParams({ search: searchTerm || null }), 500);
    return () => clearTimeout(timer);
  }, [searchTerm, pushParams]);

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(page));
    router.push(`${pathname}?${params.toString()}`);
  };

  // Sorting runs in SQL via URL params; clicking the active column flips
  // direction, a new column starts descending.
  const handleSort = (key: string) => {
    const nextDir = sortKey === key && sortDirection === 'desc' ? 'asc' : 'desc';
    pushParams({ sort: key, dir: nextDir });
  };

  const handleDelete = async () => {
    if (!isDeleting) return;
    const res = await deleteProductAction(isDeleting);
    if (res.success) {
      toast('Product moved to Trash', 'success');
      router.refresh();
    } else {
      toast(res.error || 'Failed to delete', 'error');
    }
    setIsDeleting(null);
  };

  const handleRestore = async () => {
    if (!restoringId) return;
    const res = await restoreProductAction(restoringId);
    if (res.success) {
      toast('Product restored', 'success');
      router.refresh();
    } else {
      toast(res.error || 'Failed to restore', 'error');
    }
    setRestoringId(null);
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    await toggleProductStatusAction(id, !currentStatus);
    router.refresh();
  };

  const handleBulkAction = async () => {
    if (!bulkConfirm) return;
    setIsBulkProcessing(true);
    try {
      await bulkActionProducts(bulkConfirm.ids, bulkConfirm.action as 'soft-delete' | 'restore' | 'activate' | 'deactivate' | 'permanent-delete');
      setSelectedIds([]);
      router.refresh();
    } catch {
      toast('Bulk action failed', 'error');
    }
    setIsBulkProcessing(false);
    setBulkConfirm(null);
  };

  // Only genuinely destructive bulk actions get the red treatment.
  const bulkConfirmCopy = (() => {
    const count = bulkConfirm?.ids.length ?? 0;
    const noun = `${count} product${count === 1 ? '' : 's'}`;
    switch (bulkConfirm?.action) {
      case 'permanent-delete':
        return {
          title: `Delete ${noun} forever?`,
          description: 'This permanently removes them and cannot be undone.',
          confirmText: 'Delete forever',
          variant: 'danger' as const,
        };
      case 'soft-delete':
        return {
          title: `Move ${noun} to Trash?`,
          description: 'They stop appearing on the storefront. You can restore them from the Trash tab.',
          confirmText: 'Move to Trash',
          variant: 'warning' as const,
        };
      case 'restore':
        return {
          title: `Restore ${noun}?`,
          description: 'They return to the active catalogue.',
          confirmText: 'Restore',
          variant: 'info' as const,
        };
      case 'activate':
        return {
          title: `Activate ${noun}?`,
          description: 'They become visible and purchasable on the storefront.',
          confirmText: 'Activate',
          variant: 'info' as const,
        };
      default:
        return {
          title: `Deactivate ${noun}?`,
          description: 'They stay in the catalogue but stop appearing on the storefront.',
          confirmText: 'Deactivate',
          variant: 'warning' as const,
        };
    }
  })();

  const columns: ColumnDef<ProductListItem>[] = [
    {
      key: 'name',
      header: 'Product',
      sortable: true,
      cell: (item) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-muted overflow-hidden flex-shrink-0 relative">
            {item.images?.[0]?.url ? (
              <Image src={item.images[0].url} alt={item.name} fill sizes="40px" className="object-cover" />
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
      sortable: true,
      cell: (item) => <span className="font-medium">{formatPrice(item.basePrice)}</span>,
    },
    {
      key: 'isActive',
      header: 'Active',
      cell: (item) => (
        <button onClick={() => toggleStatus(item.id, item.isActive)}>
          <StatusBadge status={item.isActive ? 'success' : 'draft'} />
        </button>
      ),
    },
    {
      key: 'isFeatured',
      header: 'Featured',
      cell: (item) =>
        item.isFeatured ? <Star className="h-4 w-4 text-amber-500 fill-amber-500" /> : <span className="text-muted-foreground">—</span>,
    },
  ];

  // Read-only roles previously saw every control, clicked it, and were
  // silently redirected to the dashboard with their work discarded.
  const bulkActions = !canWrite ? null : viewMode === 'deleted' ? (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setBulkConfirm({ action: 'restore', ids: selectedIds })}
        disabled={isBulkProcessing}
        className="px-3 py-1.5 border border-border bg-background rounded-md text-xs font-medium hover:bg-muted"
      >
        Restore
      </button>
      {canDelete ? (
        <button
          type="button"
          onClick={() => setBulkConfirm({ action: 'permanent-delete', ids: selectedIds })}
          disabled={isBulkProcessing}
          className="px-3 py-1.5 border border-destructive/50 bg-destructive/10 rounded-md text-xs font-medium text-destructive hover:bg-destructive/20"
        >
          Delete Forever
        </button>
      ) : null}
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setBulkConfirm({ action: 'activate', ids: selectedIds })}
        disabled={isBulkProcessing}
        className="px-3 py-1.5 border border-green-600/50 bg-green-600/10 rounded-md text-xs font-medium text-green-600 hover:bg-green-600/20 flex items-center gap-1"
      >
        <CheckCircle className="h-3 w-3" /> Activate
      </button>
      <button
        type="button"
        onClick={() => setBulkConfirm({ action: 'deactivate', ids: selectedIds })}
        disabled={isBulkProcessing}
        className="px-3 py-1.5 border border-muted-foreground/30 bg-muted rounded-md text-xs font-medium text-muted-foreground hover:bg-muted/80 flex items-center gap-1"
      >
        <XCircle className="h-3 w-3" /> Deactivate
      </button>
      {canDelete ? (
        <button
          type="button"
          onClick={() => setBulkConfirm({ action: 'soft-delete', ids: selectedIds })}
          disabled={isBulkProcessing}
          className="px-3 py-1.5 border border-destructive/50 bg-destructive/10 rounded-md text-xs font-medium text-destructive hover:bg-destructive/20"
        >
          Delete Selected
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'active' ? 'bg-primary text-primary-foreground' : 'bg-background border border-border text-muted-foreground hover:bg-muted'}`}
          onClick={() => pushParams({ status: null })}
        >
          Active
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'deleted' ? 'bg-primary text-primary-foreground' : 'bg-background border border-border text-muted-foreground hover:bg-muted'}`}
          onClick={() => pushParams({ status: 'archived' })}
        >
          Trash
        </button>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={brandFilter}
          onChange={(e) => pushParams({ brand: e.target.value || null })}
          className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Brands</option>
          {filterOptions.brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => pushParams({ category: e.target.value || null })}
          className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Categories</option>
          {filterOptions.categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => pushParams({ status: e.target.value || null })}
          className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>

        <select
          value={featuredFilter}
          onChange={(e) => pushParams({ featured: e.target.value || null })}
          className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All</option>
          <option value="true">Featured Only</option>
          <option value="false">Not Featured</option>
        </select>

        {(brandFilter || categoryFilter || statusFilter || featuredFilter) && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              router.push(pathname);
            }}
            className="text-xs text-primary hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <DataTable
        data={initialData.items}
        columns={columns}
        onSearch={setSearchTerm}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
        page={initialData.page}
        totalPages={initialData.totalPages}
        onPageChange={handlePageChange}
        selectable
        getRowLabel={(product) => product.name}
        selectedIds={selectedIds}
        onSelect={setSelectedIds}
        bulkActions={bulkActions}
        rowActions={(item) => (
          <div className="flex items-center justify-end gap-2">
            <Link
              href={`/products/${item.slug}`}
              target="_blank"
              className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-muted"
              title="Preview"
            >
              <Eye className="h-4 w-4" />
            </Link>
            {viewMode === 'deleted' ? (
              canDelete ? (
                <button
                  onClick={() => setRestoringId(item.id)}
                  className="p-1.5 text-muted-foreground hover:text-success transition-colors rounded-md hover:bg-muted"
                  title="Restore"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              ) : null
            ) : (
              <>
                {canWrite ? (
                  <Link
                    href={`/admin/catalog/products/${item.id}`}
                    className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-muted"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </Link>
                ) : null}
                {canDelete ? (
                  <button
                    onClick={() => setIsDeleting(item.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-muted"
                    title="Delete"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                ) : null}
              </>
            )}
          </div>
        )}
      />

      <ConfirmationDialog
        isOpen={!!isDeleting}
        title="Move product to Trash"
        description="It stops appearing on the storefront and moves to the Trash tab, where you can restore it later."
        confirmText="Move to Trash"
        cancelText="Keep"
        variant="warning"
        onConfirm={handleDelete}
        onCancel={() => setIsDeleting(null)}
      />

      <ConfirmationDialog
        isOpen={!!restoringId}
        title="Restore product"
        description="It returns to the active catalogue. Check its stock and status before it goes back on sale."
        confirmText="Restore"
        variant="info"
        onConfirm={handleRestore}
        onCancel={() => setRestoringId(null)}
      />

      <ConfirmationDialog
        isOpen={!!bulkConfirm}
        title={bulkConfirmCopy.title}
        description={bulkConfirmCopy.description}
        confirmText={bulkConfirmCopy.confirmText}
        variant={bulkConfirmCopy.variant}
        isLoading={isBulkProcessing}
        onConfirm={handleBulkAction}
        onCancel={() => setBulkConfirm(null)}
      />
    </>
  );
}