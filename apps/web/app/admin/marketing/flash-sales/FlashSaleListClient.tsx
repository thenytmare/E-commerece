'use client';

import React, { useState } from 'react';
import { DataTable, type ColumnDef } from '@/components/admin/ui/DataTable';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import { ConfirmationDialog } from '@/components/admin/ui/ConfirmationDialog';
import { Plus, Trash } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createFlashSaleAction, deleteFlashSaleAction } from '@/lib/actions/admin-flash-sales';
import { formatDateTime, formatPrice } from '@/lib/format';
import { usePermissions } from '@/lib/hooks/use-permissions';

type FlashSaleRow = {
  id: string;
  productId: string;
  productName: string;
  salePrice: number;
  basePrice: number;
  startsAt: string;
  endsAt: string;
};

type ProductOption = { id: string; name: string; basePrice: number };

function saleState(row: FlashSaleRow): { label: string; status: 'success' | 'pending' | 'archived' } {
  const now = Date.now();
  if (new Date(row.startsAt).getTime() > now) return { label: 'Scheduled', status: 'pending' };
  if (new Date(row.endsAt).getTime() < now) return { label: 'Expired', status: 'archived' };
  return { label: 'Active', status: 'success' };
}

export function FlashSaleListClient({
  initialData,
  products,
}: {
  initialData: FlashSaleRow[];
  products: ProductOption[];
}) {
  const router = useRouter();
  const { can } = usePermissions();
  const canWrite = can('marketing.write');
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ productId: '', salePrice: '', startsAt: '', endsAt: '' });

  const filtered = initialData.filter((s) =>
    s.productName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    // <input type="datetime-local"> has no timezone info; new Date() on it
    // uses the browser's local timezone, which is the admin's. Convert to a
    // UTC ISO string here so the server-side parse isn't ambiguous.
    const toIsoOrEmpty = (localValue: string) => (localValue ? new Date(localValue).toISOString() : '');

    const formData = new FormData();
    formData.append('productId', form.productId);
    formData.append('salePrice', form.salePrice);
    formData.append('startsAt', toIsoOrEmpty(form.startsAt));
    formData.append('endsAt', toIsoOrEmpty(form.endsAt));

    const res = await createFlashSaleAction(null, formData);
    setSaving(false);

    if (res.error) {
      setError(res.error);
      return;
    }
    setShowForm(false);
    setForm({ productId: '', salePrice: '', startsAt: '', endsAt: '' });
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    await deleteFlashSaleAction(deletingId);
    setDeletingId(null);
    router.refresh();
  };

  const columns: ColumnDef<FlashSaleRow>[] = [
    {
      key: 'productName',
      header: 'Product',
      sortable: true,
      cell: (item) => <span className="font-medium">{item.productName}</span>,
    },
    {
      key: 'salePrice',
      header: 'Sale Price',
      cell: (item) => (
        <div>
          <span className="font-semibold">{formatPrice(item.salePrice)}</span>
          <span className="text-xs text-muted-foreground line-through ml-2">
            {formatPrice(item.basePrice)}
          </span>
        </div>
      ),
    },
    {
      key: 'window',
      header: 'Window',
      cell: (item) => (
        <span className="text-xs text-muted-foreground">
          {formatDateTime(item.startsAt)} →{' '}
          {formatDateTime(item.endsAt)}
        </span>
      ),
    },
    {
      key: 'state',
      header: 'Status',
      cell: (item) => {
        const state = saleState(item);
        return <StatusBadge status={state.status} label={state.label} />;
      },
    },
  ];

  return (
    <>
      {canWrite ? (
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={() => { setShowForm(true); setError(null); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Flash Sale
          </button>
        </div>
      ) : null}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6">
            <h3 className="text-lg font-semibold">New Flash Sale</h3>
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="grid gap-4">
              <select
                value={form.productId}
                onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
              >
                <option value="">Select a product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({formatPrice(p.basePrice)})
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Sale price (KES)"
                value={form.salePrice}
                onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
              />
              <label className="text-xs text-muted-foreground -mb-2">Starts at</label>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
              />
              <label className="text-xs text-muted-foreground -mb-2">Ends at</label>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-border rounded-md text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Create Sale'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DataTable
        data={filtered}
        columns={columns}
        onSearch={setSearchTerm}
        emptyMessage="No flash sales scheduled yet."
        rowActions={canWrite ? (item) => (
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setDeletingId(item.id)}
              className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-muted"
              aria-label="Delete"
            >
              <Trash className="h-4 w-4" />
            </button>
          </div>
        ) : undefined}
      />

      <ConfirmationDialog
        isOpen={!!deletingId}
        title="Delete Flash Sale"
        description="Remove this scheduled sale? The product returns to its normal price."
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
      />
    </>
  );
}
