'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Edit, Trash, RotateCcw } from 'lucide-react';
import { DataTable, type ColumnDef } from '@/components/admin/ui/DataTable';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import { ConfirmationDialog } from '@/components/admin/ui/ConfirmationDialog';
import { useToast } from '@/components/ui/toast';
import { deleteBrandAction, softDeleteBrandAction, restoreBrandAction, bulkActionBrands } from '@/lib/actions/admin-brands';
import { usePermissions } from '@/lib/hooks/use-permissions';

type BrandRow = { id: string; name: string; slug: string; logoUrl: string | null; isActive: boolean; isDeleted: boolean; productCount: number };
type ViewMode = 'active' | 'deleted';
type BulkAction = 'soft-delete' | 'restore' | 'activate' | 'deactivate' | 'permanent-delete';

export function BrandListClient({ initialData }: { initialData: BrandRow[] }) {
  const { toast } = useToast();
  const { can } = usePermissions();
  const canWrite = can('brands.write');
  const canDelete = can('brands.delete');
  const [data, setData] = useState(initialData);
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState<BulkAction | null>(null);

  const columns: ColumnDef<BrandRow>[] = [
    {
      key: 'name',
      header: 'Brand',
      sortable: true,
      cell: (brand) => (
        <div className="flex items-center gap-3">
          {brand.logoUrl ? (
            <Image src={brand.logoUrl} alt="" width={36} height={36} className="rounded border border-border object-contain" />
          ) : (
            <div className="h-9 w-9 rounded border border-border bg-muted" />
          )}
          <div>
            <p className="font-medium">{brand.name}</p>
            <p className="text-xs text-muted-foreground">{brand.slug}</p>
          </div>
        </div>
      ),
    },
    { key: 'productCount', header: 'Products', sortable: true, cell: (brand) => brand.productCount },
    {
      key: 'isActive',
      header: 'Status',
      cell: (brand) => <StatusBadge status={brand.isActive ? 'success' : 'draft'} />,
    },
  ];

  const remove = async () => {
    if (!deletingId) return;
    const result = await deleteBrandAction(deletingId);
    if (result.success) setData((current) => current.filter((brand) => brand.id !== deletingId));
    else toast(result.error ?? 'Could not delete brand.', 'error');
    setDeletingId(null);
  };

  const softRemove = async () => {
    if (!archivingId) return;
    const result = await softDeleteBrandAction(archivingId);
    if (result?.success === false) {
      toast(result.error ?? 'Could not archive brand.', 'error');
    } else {
      // Flip the flag rather than dropping the row, so the brand actually
      // turns up under Trash instead of vanishing until the next reload.
      setData((c) => c.map((b) => (b.id === archivingId ? { ...b, isDeleted: true } : b)));
    }
    setArchivingId(null);
  };

  const restore = async () => {
    if (!restoringId) return;
    await restoreBrandAction(restoringId);
    setData((c) => c.map((b) => (b.id === restoringId ? { ...b, isDeleted: false } : b)));
    setRestoringId(null);
  };

  const runBulk = async (action: BulkAction) => {
    if (selectedIds.length === 0) return;
    setBulkLoading(true);
    const res = await bulkActionBrands(selectedIds, action);
    setBulkLoading(false);

    if (!res.success) {
      toast(res.error ?? `Bulk ${action} failed`, 'error');
      return;
    }

    // Reflect what the action actually did, so rows move between tabs rather
    // than disappearing from both.
    setData((current) => {
      if (action === 'permanent-delete') {
        return current.filter((b) => !selectedIds.includes(b.id));
      }
      return current.map((b) => {
        if (!selectedIds.includes(b.id)) return b;
        if (action === 'soft-delete') return { ...b, isDeleted: true };
        if (action === 'restore') return { ...b, isDeleted: false };
        return { ...b, isActive: action === 'activate' };
      });
    });
    setSelectedIds([]);
  };

  // Destructive bulk actions confirm first; the rest apply immediately.
  const handleBulk = (action: BulkAction) => {
    if (action === 'permanent-delete' || action === 'soft-delete') {
      setBulkConfirm(action);
      return;
    }
    void runBulk(action);
  };

  const exportCSV = () => {
    const rows = filtered.map((b) => ({
      Name: b.name,
      Slug: b.slug,
      Active: b.isActive ? 'Yes' : 'No',
      Products: b.productCount,
    }));
    const header = Object.keys(rows[0] || {}).join(',');
    const body = rows.map((r) => Object.values(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'brands-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // The tab decides which rows belong here; the query narrows within it.
  const filtered = data.filter(
    (brand) =>
      brand.isDeleted === (viewMode === 'deleted') &&
      brand.name.toLowerCase().includes(query.toLowerCase())
  );

  // Read-only roles previously saw every control, clicked it, and were
  // silently redirected to the dashboard with their work discarded.
  const bulkActions = !canWrite ? null : (
    <div className="flex items-center gap-2">
      {viewMode === 'active' && (
        <>
          <button type="button" className="px-3 py-1.5 border border-border bg-background rounded-md text-xs font-medium hover:bg-muted" onClick={() => handleBulk('deactivate')} disabled={bulkLoading}>Deactivate</button>
          {canDelete ? (
            <button type="button" className="px-3 py-1.5 border border-warning/50 bg-warning/10 rounded-md text-xs font-medium text-warning hover:bg-warning/20" onClick={() => handleBulk('soft-delete')} disabled={bulkLoading}>Archive</button>
          ) : null}
        </>
      )}
      {viewMode === 'deleted' && canDelete && (
        <>
          <button type="button" className="px-3 py-1.5 border border-border bg-background rounded-md text-xs font-medium hover:bg-muted" onClick={() => handleBulk('restore')} disabled={bulkLoading}>Restore</button>
          <button type="button" className="px-3 py-1.5 border border-destructive/50 bg-destructive/10 rounded-md text-xs font-medium text-destructive hover:bg-destructive/20" onClick={() => handleBulk('permanent-delete')} disabled={bulkLoading}>Delete Forever</button>
        </>
      )}
    </div>
  );

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <button type="button" className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'active' ? 'bg-primary text-primary-foreground' : 'bg-background border border-border text-muted-foreground hover:bg-muted'}`} onClick={() => { setViewMode('active'); setSelectedIds([]); }}>Active</button>
        <button type="button" className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'deleted' ? 'bg-primary text-primary-foreground' : 'bg-background border border-border text-muted-foreground hover:bg-muted'}`} onClick={() => { setViewMode('deleted'); setSelectedIds([]); }}>Trash</button>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        onSearch={setQuery}
        selectable={canWrite}
        getRowLabel={(brand) => brand.name}
        selectedIds={selectedIds}
        onSelect={setSelectedIds}
        bulkActions={bulkActions}
        onExport={exportCSV}
        exportFilename="brands-export.csv"
        rowActions={(brand) => (
          <div className="flex justify-end gap-2">
            {viewMode === 'active' ? (
              <>
                {canWrite ? (
                  <Link href={`/admin/catalog/brands/${brand.id}`} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-primary" aria-label={`Edit ${brand.name}`}>
                    <Edit className="h-4 w-4" />
                  </Link>
                ) : null}
                {canDelete ? (
                  <button type="button" onClick={() => setArchivingId(brand.id)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-warning" aria-label={`Archive ${brand.name}`}>
                    <Trash className="h-4 w-4" />
                  </button>
                ) : null}
              </>
            ) : canDelete ? (
              <button type="button" onClick={() => setRestoringId(brand.id)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-success" aria-label={`Restore ${brand.name}`}>
                <RotateCcw className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        )}
      />
      <ConfirmationDialog isOpen={Boolean(deletingId)} title="Delete brand" description="This cannot be undone." confirmText="Delete" variant="danger" onConfirm={remove} onCancel={() => setDeletingId(null)} />
      <ConfirmationDialog
        isOpen={Boolean(archivingId)}
        title="Archive brand"
        description="It moves to Trash and stops appearing on the storefront. You can restore it later."
        confirmText="Archive"
        variant="warning"
        onConfirm={softRemove}
        onCancel={() => setArchivingId(null)}
      />
      <ConfirmationDialog
        isOpen={bulkConfirm !== null}
        title={bulkConfirm === 'permanent-delete' ? `Delete ${selectedIds.length} brand(s) forever?` : `Archive ${selectedIds.length} brand(s)?`}
        description={
          bulkConfirm === 'permanent-delete'
            ? 'This permanently removes them and cannot be undone.'
            : 'They move to Trash and stop appearing on the storefront. You can restore them later.'
        }
        confirmText={bulkConfirm === 'permanent-delete' ? 'Delete forever' : 'Archive'}
        variant={bulkConfirm === 'permanent-delete' ? 'danger' : 'warning'}
        isLoading={bulkLoading}
        onConfirm={() => {
          const action = bulkConfirm;
          setBulkConfirm(null);
          if (action) void runBulk(action);
        }}
        onCancel={() => setBulkConfirm(null)}
      />
      <ConfirmationDialog isOpen={Boolean(restoringId)} title="Restore brand" description="Restore this brand from the trash?" confirmText="Restore" variant="info" onConfirm={restore} onCancel={() => setRestoringId(null)} />
    </>
  );
}