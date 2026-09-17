'use client';

import React, { useState } from 'react';
import { DataTable, type ColumnDef } from '@/components/admin/ui/DataTable';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import { ConfirmationDialog } from '@/components/admin/ui/ConfirmationDialog';
import { useToast } from '@/components/ui/toast';
import type { AdminCategoryListItem } from '@repo/database';
import Link from 'next/link';
import { Edit, Trash, RotateCcw } from 'lucide-react';
import {
  deleteCategoryAction,
  softDeleteCategoryAction,
  restoreCategoryAction,
  bulkActionCategories,
} from '@/lib/actions/admin-categories';
import { usePermissions } from '@/lib/hooks/use-permissions';

type ViewMode = 'active' | 'deleted';

export function CategoryListClient({ initialData }: { initialData: AdminCategoryListItem[] }) {
  const { toast } = useToast();
  const { can } = usePermissions();
  const canWrite = can('categories.write');
  const canDelete = can('categories.delete');
  const [data, setData] = useState(initialData);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [bulkLoading, setBulkLoading] = useState(false);

  const handleDelete = async () => {
    if (!isDeleting) return;
    const res = await deleteCategoryAction(isDeleting);
    if (res.success) {
      setData(data.filter((c) => c.id !== isDeleting));
    } else {
      toast(res.error || 'Failed to delete', 'error');
    }
    setIsDeleting(null);
  };

  const handleSoftDelete = async (id: string) => {
    const res = await softDeleteCategoryAction(id);
    if (res.success) {
      setData(data.filter((c) => c.id !== id));
    } else {
      toast(res.error || 'Failed to archive', 'error');
    }
  };

  const handleRestore = async () => {
    if (!isRestoring) return;
    const res = await restoreCategoryAction(isRestoring);
    if (res.success) {
      setData(data.filter((c) => c.id !== isRestoring));
    } else {
      toast(res.error || 'Failed to restore', 'error');
    }
    setIsRestoring(null);
  };

  const handleBulkAction = async (action: 'soft-delete' | 'restore' | 'activate' | 'deactivate' | 'permanent-delete') => {
    if (selectedIds.length === 0) return;
    setBulkLoading(true);
    const res = await bulkActionCategories(selectedIds, action);
    setBulkLoading(false);
    if (res.success) {
      setData(data.filter((c) => !selectedIds.includes(c.id)));
      setSelectedIds([]);
    } else {
      toast(res.error || `Bulk ${action} failed`, 'error');
    }
  };

  const filteredData = data.filter((c) => {
    // The tab decides which rows belong here; search narrows within it.
    const matchesTab = viewMode === 'deleted' ? c.deletedAt !== null : c.deletedAt === null;
    if (!matchesTab) return false;

    const term = searchTerm.toLowerCase();
    return c.name.toLowerCase().includes(term) || c.slug.toLowerCase().includes(term);
  });

  const columns: ColumnDef<AdminCategoryListItem>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      cell: (item) => (
        <div>
          <p className="font-medium">{item.name}</p>
          {item.parent && (
            <p className="text-xs text-muted-foreground mt-0.5">
              ↳ Under {item.parent.name}
            </p>
          )}
        </div>
      ),
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
      cell: (item) => (
        <span className="text-muted-foreground">{item._count.products} products</span>
      ),
    },
  ];

  const exportCSV = () => {
    const rows = filteredData.map((c) => ({
      Name: c.name,
      Slug: c.slug,
      Parent: c.parent?.name ?? '—',
      Active: c.isActive ? 'Yes' : 'No',
      Products: c._count.products,
      Children: c._count.children,
    }));
    const header = Object.keys(rows[0] || {}).join(',');
    const body = rows.map((r) => Object.values(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const csv = header + '\n' + body;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'categories-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Read-only roles previously saw every control, clicked it, and were
  // silently redirected to the dashboard with their work discarded.
  const bulkActions = !canWrite ? null : (
    <div className="flex items-center gap-2">
      {viewMode === 'active' && (
        <>
          <button
            type="button"
            className="px-3 py-1.5 border border-border bg-background rounded-md text-xs font-medium hover:bg-muted transition-colors"
            onClick={() => handleBulkAction('deactivate')}
            disabled={bulkLoading}
          >
            Deactivate
          </button>
          {canDelete ? (
            <button
              type="button"
              className="px-3 py-1.5 border border-warning/50 bg-warning/10 rounded-md text-xs font-medium text-warning hover:bg-warning/20 transition-colors"
              onClick={() => handleBulkAction('soft-delete')}
              disabled={bulkLoading}
            >
              Archive
            </button>
          ) : null}
        </>
      )}
      {viewMode === 'deleted' && canDelete && (
        <>
          <button
            type="button"
            className="px-3 py-1.5 border border-border bg-background rounded-md text-xs font-medium hover:bg-muted transition-colors"
            onClick={() => handleBulkAction('restore')}
            disabled={bulkLoading}
          >
            Restore
          </button>
          <button
            type="button"
            className="px-3 py-1.5 border border-destructive/50 bg-destructive/10 rounded-md text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
            onClick={() => handleBulkAction('permanent-delete')}
            disabled={bulkLoading}
          >
            Delete Forever
          </button>
        </>
      )}
    </div>
  );

  return (
    <>
      {/* View mode tabs */}
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            viewMode === 'active'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background border border-border text-muted-foreground hover:bg-muted'
          }`}
          onClick={() => {
            setViewMode('active');
            setSelectedIds([]);
          }}
        >
          Active
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            viewMode === 'deleted'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background border border-border text-muted-foreground hover:bg-muted'
          }`}
          onClick={() => {
            setViewMode('deleted');
            setSelectedIds([]);
          }}
        >
          Trash
        </button>
      </div>

      <DataTable
        data={filteredData}
        columns={columns}
        onSearch={setSearchTerm}
        selectable={canWrite}
        getRowLabel={(category) => category.name}
        selectedIds={selectedIds}
        onSelect={setSelectedIds}
        bulkActions={bulkActions}
        onExport={exportCSV}
        exportFilename="categories-export.csv"
        rowActions={(item) => (
          <div className="flex items-center justify-end gap-2">
            {viewMode === 'active' ? (
              <>
                {canWrite ? (
                  <Link
                    href={`/admin/catalog/categories/${item.id}`}
                    className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-muted"
                    aria-label={`Edit ${item.name}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Link>
                ) : null}
                {canDelete ? (
                  <button
                    onClick={() => handleSoftDelete(item.id)}
                    className="p-1.5 text-muted-foreground hover:text-warning transition-colors rounded-md hover:bg-muted"
                    aria-label={`Archive ${item.name}`}
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                ) : null}
              </>
            ) : canDelete ? (
              <button
                onClick={() => setIsRestoring(item.id)}
                className="p-1.5 text-muted-foreground hover:text-success transition-colors rounded-md hover:bg-muted"
                aria-label={`Restore ${item.name}`}
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        )}
      />

      {/* Soft delete confirmation */}
      <ConfirmationDialog
        isOpen={!!isDeleting}
        title="Delete Category"
        description="Are you sure you want to permanently delete this category? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setIsDeleting(null)}
      />

      {/* Restore confirmation */}
      <ConfirmationDialog
        isOpen={!!isRestoring}
        title="Restore Category"
        description="Restore this category from the trash?"
        confirmText="Restore"
        variant="info"
        onConfirm={handleRestore}
        onCancel={() => setIsRestoring(null)}
      />
    </>
  );
}