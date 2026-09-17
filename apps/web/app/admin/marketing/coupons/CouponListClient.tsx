'use client';

import React, { useState } from 'react';
import { DataTable, ColumnDef } from '@/components/admin/ui/DataTable';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import { ConfirmationDialog } from '@/components/admin/ui/ConfirmationDialog';
import { FormSection } from '@/components/admin/forms/FormSection';
import { FormField } from '@/components/admin/forms/FormField';
import { createCouponAction, updateCouponAction, deleteCouponAction } from '@/lib/actions/admin-coupons';
import { useRouter } from 'next/navigation';
import { Percent, DollarSign, Plus, Trash } from 'lucide-react';
import { usePermissions } from '@/lib/hooks/use-permissions';

type Coupon = {
  id: string;
  code: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  minOrder: number | null;
  maxUses: number | null;
  maxUsesPerCustomer: number | null;
  usedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
};

export function CouponListClient({ coupons }: { coupons: Coupon[] }) {
  const router = useRouter();
  const { can } = usePermissions();
  const canWrite = can('marketing.write');
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formType, setFormType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');

  const editing = editingId ? coupons.find(c => c.id === editingId) : null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const formData = new FormData(e.currentTarget);

    // <input type="datetime-local"> has no timezone info; new Date() on it
    // uses the browser's local timezone, which is the admin's. Convert to a
    // UTC ISO string here so the server-side parse isn't ambiguous.
    for (const field of ['startsAt', 'endsAt'] as const) {
      const raw = formData.get(field);
      if (typeof raw === 'string' && raw) {
        formData.set(field, new Date(raw).toISOString());
      }
    }

    const res = editingId
      ? await updateCouponAction(editingId, null, formData)
      : await createCouponAction(null, formData);

    if (res.error) setError(res.error);
    else router.refresh();
    setIsSubmitting(false);
    if (!res.error) setEditingId(null);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    await deleteCouponAction(deletingId);
    router.refresh();
    setDeletingId(null);
  };

  const columns: ColumnDef<Coupon>[] = [
    { key: 'code', header: 'Code', cell: (item) => <span className="font-mono font-bold text-sm">{item.code}</span> },
    { key: 'type', header: 'Type', cell: (item) => <span>{item.type === 'PERCENTAGE' ? `${item.value}%` : `KES ${item.value}`}</span> },
    { key: 'usedCount', header: 'Used', cell: (item) => <span>{item.usedCount}{item.maxUses ? ` / ${item.maxUses}` : ''}</span> },
    {
      key: 'isActive',
      header: 'Status',
      cell: (item) => <StatusBadge status={item.isActive ? 'success' : 'draft'} />,
    },
  ];

  return (
    <div className="space-y-6">
      {canWrite ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => { setIsOpen(true); setEditingId(null); setFormType('PERCENTAGE'); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New Coupon
          </button>
        </div>
      ) : null}

      <DataTable
        data={coupons}
        columns={columns}
        rowActions={canWrite ? (item) => (
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setIsOpen(true); setEditingId(item.id); setFormType(item.type); }} className="text-xs text-primary hover:underline">Edit</button>
            <button onClick={() => setDeletingId(item.id)} className="text-xs text-destructive hover:underline"><Trash className="h-3 w-3 inline" /></button>
          </div>
        ) : undefined}
      />

      {/* Create/Edit Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setIsOpen(false)}>
          <div className="bg-card border border-border rounded-lg w-full max-w-lg m-4 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <h3 className="text-lg font-semibold">{editing ? 'Edit Coupon' : 'New Coupon'}</h3>
              {error && <div className="bg-destructive/10 text-destructive text-sm rounded-md px-3 py-2">{error}</div>}

              <FormField id="code" label="Coupon Code" required>
                <input type="text" id="code" name="code" defaultValue={editing?.code ?? ''} required className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm uppercase" placeholder="SUMMER2026" />
              </FormField>

              <div className="flex gap-3">
                <label className="flex-1"><input type="radio" name="type" value="PERCENTAGE" checked={formType === 'PERCENTAGE'} onChange={() => setFormType('PERCENTAGE')} /> Percentage</label>
                <label className="flex-1"><input type="radio" name="type" value="FIXED" checked={formType === 'FIXED'} onChange={() => setFormType('FIXED')} /> Fixed (KES)</label>
              </div>

              <FormField id="value" label={formType === 'PERCENTAGE' ? 'Discount (%)' : 'Discount (KES)'} required>
                <input type="number" id="value" name="value" defaultValue={editing?.value ?? ''} required className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField id="minOrder" label="Min Order (KES)">
                  <input type="number" id="minOrder" name="minOrder" defaultValue={editing?.minOrder ?? ''} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" />
                </FormField>
                <FormField id="maxUses" label="Max uses (total)" description="Leave blank for unlimited">
                  <input type="number" min="1" id="maxUses" name="maxUses" defaultValue={editing?.maxUses ?? ''} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  id="maxUsesPerCustomer"
                  label="Max uses per customer"
                  description="Leave blank to allow unlimited reuse by the same account"
                >
                  <input
                    type="number"
                    min="1"
                    id="maxUsesPerCustomer"
                    name="maxUsesPerCustomer"
                    defaultValue={editing?.maxUsesPerCustomer ?? ''}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField id="startsAt" label="Starts At">
                  <input type="datetime-local" id="startsAt" name="startsAt" defaultValue={editing?.startsAt ? new Date(editing.startsAt).toISOString().slice(0, 16) : ''} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" />
                </FormField>
                <FormField id="endsAt" label="Ends At">
                  <input type="datetime-local" id="endsAt" name="endsAt" defaultValue={editing?.endsAt ? new Date(editing.endsAt).toISOString().slice(0, 16) : ''} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" />
                </FormField>
              </div>

              <label className="flex items-center gap-2">
                <input type="checkbox" name="isActive" defaultChecked={editing ? editing.isActive : true} />
                <span className="text-sm">Active</span>
              </label>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 border border-border rounded-md text-sm">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">{isSubmitting ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationDialog isOpen={!!deletingId} title="Delete Coupon" description="Delete this coupon permanently?" confirmText="Delete" variant="danger" onConfirm={handleDelete} onCancel={() => setDeletingId(null)} />
    </div>
  );
}