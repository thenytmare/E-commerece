'use client';

import React, { useState } from 'react';
import { DataTable, ColumnDef } from '@/components/admin/ui/DataTable';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import type { InventoryAlertData } from '@/lib/admin/catalog-dtos';
import { restockVariantAction } from '@/lib/actions/admin-back-in-stock';
import { useRouter } from 'next/navigation';
import { PackagePlus } from 'lucide-react';
import { usePermissions } from '@/lib/hooks/use-permissions';

export function InventoryListClient({ initialLowStock }: { initialLowStock: InventoryAlertData[] }) {
  const router = useRouter();
  const { can } = usePermissions();
  const canWrite = can('inventory.write');
  const [data] = useState<InventoryAlertData[]>(initialLowStock);
  const [searchTerm, setSearchTerm] = useState('');
  const [restocking, setRestocking] = useState<InventoryAlertData | null>(null);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleRestock = async () => {
    if (!restocking) return;
    const change = Number(amount);
    if (!Number.isFinite(change) || change <= 0) return;

    setSaving(true);
    const res = await restockVariantAction(restocking.variantId, restocking.variant.productId, change);
    setSaving(false);

    if (res.success) {
      setFeedback(
        res.notified
          ? `Stock updated. ${res.notified} waiting customer(s) moved to the Back-in-Stock queue.`
          : 'Stock updated.'
      );
      setRestocking(null);
      setAmount('');
      router.refresh();
    } else {
      setFeedback(res.error ?? 'Failed to update stock.');
    }
  };

  const filteredData = data.filter((item) =>
    item.variant.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.variant.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns: ColumnDef<InventoryAlertData>[] = [
    {
      key: 'product',
      header: 'Product Details',
      cell: (item) => (
        <div>
          <p className="font-semibold text-foreground">{item.variant.product.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">SKU: {item.variant.sku}</p>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'quantity',
      header: 'On Hand',
      cell: (item) => <span className="font-medium">{item.quantity}</span>,
      sortable: true,
    },
    {
      key: 'reserved',
      header: 'Reserved',
      cell: (item) => <span className="text-muted-foreground">{item.reserved}</span>,
      sortable: true,
    },
    {
      key: 'available',
      header: 'Available',
      cell: (item) => {
        const available = item.quantity - item.reserved;
        return (
          <span className={`font-semibold ${available <= 0 ? 'text-destructive' : 'text-foreground'}`}>
            {available}
          </span>
        );
      },
    },
    {
      key: 'lowStockThreshold',
      header: 'Threshold',
      cell: (item) => <span className="text-muted-foreground">{item.lowStockThreshold}</span>,
      sortable: true,
    },
    {
      key: 'alert',
      header: 'Alert Level',
      cell: (item) => {
        const available = item.quantity - item.reserved;
        if (available <= 0) {
          return <StatusBadge status="danger" label="OUT OF STOCK" />;
        }
        return <StatusBadge status="warning" label="LOW STOCK" />;
      },
    },
  ];

  return (
    <>
      {feedback && (
        <div className="mb-4 rounded-md border border-border bg-muted/30 px-4 py-2 text-sm">
          {feedback}
        </div>
      )}

      {restocking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6">
            <div>
              <h3 className="text-lg font-semibold">Restock</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {restocking.variant.product.name} · {restocking.variant.sku}
              </p>
            </div>
            <div>
              <label htmlFor="restock-amount" className="text-sm font-medium block mb-1">
                Quantity to add
              </label>
              <input
                id="restock-amount"
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setRestocking(null); setAmount(''); }}
                className="px-4 py-2 border border-border rounded-md text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestock}
                disabled={saving || !amount || Number(amount) <= 0}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Add Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DataTable
        data={filteredData}
        columns={columns}
        onSearch={setSearchTerm}
        emptyMessage="Great! All products are adequately stocked."
        rowActions={canWrite ? (item) => (
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => { setRestocking(item); setFeedback(null); }}
              className="p-1.5 text-muted-foreground hover:text-primary rounded-md hover:bg-muted"
              title="Restock"
            >
              <PackagePlus className="h-4 w-4" />
            </button>
          </div>
        ) : undefined}
      />
    </>
  );
}
