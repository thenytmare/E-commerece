'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DataTable, ColumnDef } from '@/components/admin/ui/DataTable';
import Link from 'next/link';
import Image from 'next/image';
import { Edit, Trash, Eye, EyeOff, Star, RotateCcw } from 'lucide-react';
import {
  deleteProductAction,
  restoreProductAction,
  setProductVisibilityAction,
  bulkSetProductVisibilityAction,
  bulkActionProducts,
} from '@/lib/actions/admin-products';
import { VisibilitySwitch } from './VisibilitySwitch';
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
  /** Units available to buy across all variants. */
  availableStock: number;
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

const LOW_STOCK_AT = 5;

function StockLabel({ stock }: { stock: number }) {
  if (stock <= 0) return <span className="text-xs font-medium text-destructive">Out of stock</span>;
  if (stock <= LOW_STOCK_AT) return <span className="text-xs font-medium text-amber-700">{stock} left (low)</span>;
  return <span className="text-xs text-muted-foreground">{stock} in stock</span>;
}

export function ProductListClient({
  initialData,
  initialSearch,
  counts,
  visibility,
  filterOptions,
  sortKey,
  sortDirection,
}: {
  initialData: PaginatedProducts;
  initialSearch: string;
  counts: { all: number; visible: number; hidden: number };
  visibility: 'all' | 'visible' | 'hidden';
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

  // Optimistic switch state. A switch moves at once, then the server confirms.
  // `overrides` holds the value the admin just chose. `busyIds` are rows whose
  // request is still running, so a quick second click cannot send a conflicting one.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [busyIds, setBusyIds] = useState<string[]>([]);
  useEffect(() => {
    // Fresh data from the server replaces any local guesses.
    setOverrides({});
  }, [initialData]);

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState<{ action: string; ids: string[] } | null>(null);
  const isVisible = (item: ProductListItem) => overrides[item.id] ?? item.isActive;

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

  const handleToggle = async (item: ProductListItem, next: boolean) => {
    if (busyIds.includes(item.id)) return;
    setBusyIds((ids) => [...ids, item.id]);
    setOverrides((current) => ({ ...current, [item.id]: next }));
    try {
      const res = await setProductVisibilityAction(item.id, next);
      if (!res.success) throw new Error(res.error || 'Could not change visibility.');
      toast(next ? `${item.name} is now visible to customers` : `${item.name} is now hidden from customers`, 'success');
      router.refresh();
    } catch (error) {
      // Put the switch back where it was and say why.
      setOverrides((current) => {
        const copy = { ...current };
        delete copy[item.id];
        return copy;
      });
      toast(error instanceof Error ? error.message : 'Could not change visibility.', 'error');
    } finally {
      setBusyIds((ids) => ids.filter((id) => id !== item.id));
    }
  };

  const handleBulkAction = async () => {
    if (!bulkConfirm) return;
    setIsBulkProcessing(true);
    try {
      const res =
        bulkConfirm.action === 'activate' || bulkConfirm.action === 'deactivate'
          ? await bulkSetProductVisibilityAction(bulkConfirm.ids, bulkConfirm.action === 'activate')
          : await bulkActionProducts(
              bulkConfirm.ids,
              bulkConfirm.action as 'soft-delete' | 'restore' | 'permanent-delete'
            );
      const changed = 'changed' in res ? res.changed : (res as { count?: number }).count;
      if (res.success) {
        const verb =
          bulkConfirm.action === 'activate' ? 'shown' : bulkConfirm.action === 'deactivate' ? 'hidden' : 'updated';
        toast(`${changed ?? bulkConfirm.ids.length} product${changed === 1 ? '' : 's'} ${verb}`, 'success');
        setSelectedIds([]);
        router.refresh();
      } else {
        toast(res.error || 'Bulk action failed', 'error');
      }
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
          title: `Show ${noun} to customers?`,
          description: 'They appear on the storefront and can be bought.',
          confirmText: 'Show',
          variant: 'info' as const,
        };
      default:
        return {
          title: `Hide ${noun} from customers?`,
          description: 'They stay in your catalogue with their stock and order history, but customers cannot see or buy them. Items already in a cart are marked "No longer available".',
          confirmText: 'Hide',
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
          <div className={viewMode === 'active' && !isVisible(item) ? 'opacity-70' : undefined}>
            <p className="font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.brand?.name} • {item.category?.name}</p>
            {viewMode === 'active' && !isVisible(item) ? (
              <p className="mt-0.5 text-xs font-medium text-muted-foreground">Hidden from customers</p>
            ) : null}
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
      key: 'availableStock',
      header: 'Stock',
      cell: (item) => <StockLabel stock={item.availableStock} />,
    },
    {
      key: 'isActive',
      header: 'Storefront',
      cell: (item) => (
        <div>
          {viewMode === 'deleted' ? (
            <span className="text-xs text-muted-foreground">In Trash</span>
          ) : (
            <VisibilitySwitch
              checked={isVisible(item)}
              productName={item.name}
              disabled={!canWrite}
              disabledReason="You can view products but not change them."
              busy={busyIds.includes(item.id)}
              onChange={(next) => handleToggle(item, next)}
            />
          )}
          {viewMode === 'active' && isVisible(item) && item.availableStock === 0 ? (
            <p className="text-xs text-amber-700">Visible, but customers cannot buy it: out of stock</p>
          ) : null}
        </div>
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
        <Eye className="h-3 w-3" /> Show selected
      </button>
      <button
        type="button"
        onClick={() => setBulkConfirm({ action: 'deactivate', ids: selectedIds })}
        disabled={isBulkProcessing}
        className="px-3 py-1.5 border border-muted-foreground/30 bg-muted rounded-md text-xs font-medium text-muted-foreground hover:bg-muted/80 flex items-center gap-1"
      >
        <EyeOff className="h-3 w-3" /> Hide selected
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
      <div className="mb-4 flex flex-wrap items-center gap-2" role="tablist" aria-label="Product visibility">
        {(
          [
            { key: 'all', label: 'All', count: counts.all },
            { key: 'visible', label: 'Visible', count: counts.visible },
            { key: 'hidden', label: 'Hidden', count: counts.hidden },
          ] as const
        ).map((tab) => {
          const selected = viewMode === 'active' && visibility === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${selected ? 'bg-primary text-primary-foreground' : 'bg-background border border-border text-muted-foreground hover:bg-muted'}`}
              onClick={() => pushParams({ status: null, visibility: tab.key === 'all' ? null : tab.key })}
            >
              {tab.label} ({tab.count})
            </button>
          );
        })}
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'deleted'}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'deleted' ? 'bg-primary text-primary-foreground' : 'bg-background border border-border text-muted-foreground hover:bg-muted'}`}
          onClick={() => pushParams({ status: 'archived', visibility: null })}
        >
          Trash
        </button>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          aria-label="Filter by brand"
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
          aria-label="Filter by category"
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
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => pushParams({ status: e.target.value || null })}
          className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>

        <select
          aria-label="Filter by featured"
          value={featuredFilter}
          onChange={(e) => pushParams({ featured: e.target.value || null })}
          className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All</option>
          <option value="true">Featured Only</option>
          <option value="false">Not Featured</option>
        </select>

        {(brandFilter || categoryFilter || statusFilter || featuredFilter || visibility !== 'all') && (
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
        emptyTitle={
          viewMode === 'deleted' ? 'Trash is empty' : visibility === 'hidden' ? 'No hidden products' : visibility === 'visible' ? 'No visible products' : 'No products found'
        }
        emptyMessage={
          viewMode === 'deleted'
            ? 'Deleted products appear here.'
            : visibility === 'hidden'
              ? 'Every product matching these filters is visible to customers.'
              : 'Try a different search or clear the filters.'
        }
        searchValue={searchTerm}
        mobileCard={(item, checkbox) => (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              {checkbox}
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                {item.images?.[0]?.url ? (
                  <Image src={item.images[0].url} alt={item.name} fill sizes="56px" className="object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.brand?.name} • {item.category?.name}</p>
                <p className="mt-1 text-sm font-medium">{formatPrice(item.basePrice)}</p>
                <StockLabel stock={item.availableStock} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              {viewMode === 'deleted' ? (
                <span className="text-xs text-muted-foreground">In Trash</span>
              ) : (
                <VisibilitySwitch
                  checked={isVisible(item)}
                  productName={item.name}
                  disabled={!canWrite}
                  disabledReason="You can view products but not change them."
                  busy={busyIds.includes(item.id)}
                  onChange={(next) => handleToggle(item, next)}
                />
              )}
              {canWrite && viewMode === 'active' ? (
                <Link href={`/admin/catalog/products/${item.id}`} className="inline-flex min-h-[44px] items-center px-3 text-sm font-medium text-primary">
                  Edit
                </Link>
              ) : null}
            </div>
            {viewMode === 'active' && !isVisible(item) ? (
              <p className="text-xs font-medium text-muted-foreground">Hidden from customers</p>
            ) : null}
          </div>
        )}
        selectable
        getRowLabel={(product) => product.name}
        selectedIds={selectedIds}
        onSelect={setSelectedIds}
        bulkActions={bulkActions}
        rowActions={(item) => (
          <div className="flex items-center justify-end gap-2">
            {isVisible(item) && viewMode === 'active' ? (
              <Link
                href={`/products/${item.slug}`}
                target="_blank"
                className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-muted"
                title="View on storefront"
                aria-label={`View ${item.name} on the storefront`}
              >
                <Eye className="h-4 w-4" />
              </Link>
            ) : (
              <span
                className="p-1.5 text-muted-foreground/40"
                title="Hidden products are not on the storefront. Show it to preview."
              >
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              </span>
            )}
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