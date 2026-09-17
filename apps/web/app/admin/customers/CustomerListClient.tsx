'use client';

import React, { useCallback, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { DataTable, type ColumnDef } from '@/components/admin/ui/DataTable';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import { ConfirmationDialog } from '@/components/admin/ui/ConfirmationDialog';
import { useToast } from '@/components/ui/toast';
import { Eye, Trash, RotateCcw } from 'lucide-react';
import { softDeleteCustomerAction, restoreCustomerAction, bulkActionCustomers } from '@/lib/actions/admin-customers';
import { formatDate } from '@/lib/format';
import { usePermissions } from '@/lib/hooks/use-permissions';

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  roles: string[];
  ordersCount: number;
  createdAt: Date;
  isDeleted: boolean;
};

type ViewMode = 'active' | 'deleted';

export function CustomerListClient({
  initialData,
  page,
  totalPages,
  total,
  initialSearch,
}: {
  initialData: CustomerRow[];
  page: number;
  totalPages: number;
  total: number;
  initialSearch: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Search and paging run in SQL via URL params so they cover every customer.
  const pushParams = useCallback(
    (updates: Record<string, string | null>, resetPage = true) => {
      const params = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      if (resetPage) params.set('page', '1');
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const { toast } = useToast();
  const { can } = usePermissions();
  const canDelete = can('customers.delete');
  const [data, setData] = useState(initialData);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [bulkArchiving, setBulkArchiving] = useState(false);

  const handleArchive = async () => {
    if (!archivingId) return;
    const res = await softDeleteCustomerAction(archivingId);
    if (res?.success === false) {
      toast(res.error ?? 'Could not archive customer.', 'error');
    } else {
      // Flip the flag rather than dropping the row, so the customer actually
      // turns up under Trash instead of vanishing until the next reload.
      setData(c => c.map(r => (r.id === archivingId ? { ...r, isDeleted: true } : r)));
    }
    setArchivingId(null);
  };

  const handleRestore = async () => {
    if (!restoringId) return;
    await restoreCustomerAction(restoringId);
    setData(c => c.map(r => (r.id === restoringId ? { ...r, isDeleted: false } : r)));
    setRestoringId(null);
  };

  const runBulk = async (action: 'soft-delete' | 'restore') => {
    if (selectedIds.length === 0) return;
    const res = await bulkActionCustomers(selectedIds, action);
    if (res.success) {
      setData(c =>
        c.map(r =>
          selectedIds.includes(r.id) ? { ...r, isDeleted: action === 'soft-delete' } : r
        )
      );
      setSelectedIds([]);
    } else {
      toast(res.error ?? `Bulk ${action} failed`, 'error');
    }
  };

  // The tab decides which rows belong here; search narrows within it.
  // Rows for the active tab. Search itself is applied server-side.
  const filtered = data.filter(c => c.isDeleted === (viewMode === 'deleted'));

  const columns: ColumnDef<CustomerRow>[] = [
    {
      key: 'name',
      header: 'Customer',
      sortable: true,
      cell: (item) => (
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="text-xs text-muted-foreground">{item.email}</p>
        </div>
      ),
    },
    { key: 'ordersCount', header: 'Orders', sortable: true, cell: (item) => <span className="text-muted-foreground">{item.ordersCount}</span> },
    { key: 'roles', header: 'Role', cell: (item) => <span className="text-xs">{item.roles.includes('ADMIN') ? 'Admin' : item.roles.includes('MANAGER') ? 'Manager' : 'Customer'}</span> },
    { key: 'isActive', header: 'Status', cell: (item) => <StatusBadge status={item.isActive ? 'success' : 'draft'} /> },
    { key: 'createdAt', header: 'Joined', cell: (item) => <span className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</span> },
  ];

  const exportCSV = () => {
    const rows = filtered.map(c => ({ Name: c.name, Email: c.email, Phone: c.phone || '—', Status: c.isActive ? 'Active' : 'Inactive', Orders: c.ordersCount, Joined: formatDate(c.createdAt) }));
    const header = Object.keys(rows[0] || {}).join(',');
    const body = rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'customers.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Read-only roles previously saw every control, clicked it, and were
  // silently redirected to the dashboard with their work discarded.
  const bulkActions = !canDelete ? null : (
    <div className="flex items-center gap-2">
      {viewMode === 'active' && (
        <button type="button" className="px-3 py-1.5 border border-warning/50 bg-warning/10 rounded-md text-xs font-medium text-warning hover:bg-warning/20" onClick={() => setBulkArchiving(true)}>Archive</button>
      )}
      {viewMode === 'deleted' && (
        <button type="button" className="px-3 py-1.5 border border-border bg-background rounded-md text-xs font-medium hover:bg-muted" onClick={() => void runBulk('restore')}>Restore</button>
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
        onSearch={(term) => pushParams({ search: term || null })}
        searchValue={initialSearch}
        searchPlaceholder="Search name or email..."
        page={page}
        totalPages={totalPages}
        onPageChange={(next) => pushParams({ page: String(next) }, false)}
        selectable={canDelete}
        getRowLabel={(customer) => customer.name}
        selectedIds={selectedIds}
        onSelect={setSelectedIds}
        bulkActions={bulkActions}
        onExport={exportCSV}
        exportFilename="customers.csv"
        rowActions={(item) => (
          <div className="flex items-center justify-end gap-2">
            <Link href={`/admin/customers/${item.id}`} className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-muted" aria-label={`View ${item.name}`}>
              <Eye className="h-4 w-4" />
            </Link>
            {!canDelete ? null : viewMode === 'active' ? (
              <button onClick={() => setArchivingId(item.id)} className="p-1.5 text-muted-foreground hover:text-warning transition-colors rounded-md hover:bg-muted" aria-label={`Archive ${item.name}`}>
                <Trash className="h-4 w-4" />
              </button>
            ) : (
              <button onClick={() => setRestoringId(item.id)} className="p-1.5 text-muted-foreground hover:text-success transition-colors rounded-md hover:bg-muted" aria-label={`Restore ${item.name}`}>
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      />
      <ConfirmationDialog isOpen={!!restoringId} title="Restore Customer" description="Restore this customer account?" confirmText="Restore" variant="info" onConfirm={handleRestore} onCancel={() => setRestoringId(null)} />
      {/* Archiving is the higher-risk action of the two, so it confirms too —
          previously only the harmless Restore did. */}
      <ConfirmationDialog
        isOpen={!!archivingId}
        title="Archive customer"
        description="They move to Trash and can no longer sign in. Their order history is kept, and you can restore them later."
        confirmText="Archive"
        variant="warning"
        onConfirm={handleArchive}
        onCancel={() => setArchivingId(null)}
      />
      <ConfirmationDialog
        isOpen={bulkArchiving}
        title={`Archive ${selectedIds.length} customer(s)?`}
        description="They move to Trash and can no longer sign in. Their order history is kept, and you can restore them later."
        confirmText="Archive"
        variant="warning"
        onConfirm={() => {
          setBulkArchiving(false);
          void runBulk('soft-delete');
        }}
        onCancel={() => setBulkArchiving(false)}
      />
    </>
  );
}