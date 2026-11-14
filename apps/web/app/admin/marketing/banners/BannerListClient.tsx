'use client';

import React, { useState } from 'react';
import { DataTable, type ColumnDef } from '@/components/admin/ui/DataTable';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import { ConfirmationDialog } from '@/components/admin/ui/ConfirmationDialog';
import { Edit, Trash, Plus } from 'lucide-react';
import { updateBannersAction } from '@/lib/actions/admin-marketing';
import type { Banner as BannerRow } from '@/lib/banners';
import { ImageUrlField } from '@/components/admin/media/ImageUrlField';
import { useToast } from '@/components/ui/toast';
import { usePermissions } from '@/lib/hooks/use-permissions';

export function BannerListClient({ initialData }: { initialData: BannerRow[] }) {
  const { toast } = useToast();
  const { can } = usePermissions();
  const canWrite = can('marketing.write');
  const [data, setData] = useState(initialData);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BannerRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [form, setForm] = useState({ title: '', imageUrl: '', link: '', position: 'homepage', isActive: true, startsAt: '', endsAt: '' });

  const openNew = () => { setEditing(null); setForm({ title: '', imageUrl: '', link: '', position: 'homepage', isActive: true, startsAt: '', endsAt: '' }); setShowForm(true); };
  const openEdit = (b: BannerRow) => { setEditing(b); setForm({ title: b.title, imageUrl: b.imageUrl, link: b.link, position: b.position, isActive: b.isActive, startsAt: b.startsAt ?? '', endsAt: b.endsAt ?? '' }); setShowForm(true); };

  // Previously these applied the optimistic update and never looked at the
  // result, so a rejected save left the admin believing it had worked.
  const save = async () => {
    const previous = data;
    const updated = editing
      ? data.map(b => b.id === editing.id ? { ...b, ...form, startsAt: form.startsAt || null, endsAt: form.endsAt || null } : b)
      : [...data, { ...form, id: Date.now().toString(), startsAt: form.startsAt || null, endsAt: form.endsAt || null }];

    setData(updated);
    const result = await updateBannersAction(updated);
    if (!result?.success) {
      setData(previous);
      toast(result?.error ?? 'Could not save that banner.', 'error');
      return;
    }
    toast(editing ? 'Banner updated' : 'Banner added', 'success');
    setShowForm(false);
  };

  const remove = async () => {
    if (!deletingId) return;
    const previous = data;
    const updated = data.filter(b => b.id !== deletingId);
    setData(updated);
    setDeletingId(null);

    const result = await updateBannersAction(updated);
    if (!result?.success) {
      setData(previous);
      toast(result?.error ?? 'Could not delete that banner.', 'error');
      return;
    }
    toast('Banner deleted', 'success');
  };

  const filtered = data.filter(b => b.title.toLowerCase().includes(searchTerm.toLowerCase()));

  const columns: ColumnDef<BannerRow>[] = [
    { key: 'title', header: 'Title', sortable: true, cell: (item) => <div><p className="font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.link}</p></div> },
    { key: 'position', header: 'Position', cell: (item) => <span className="text-sm capitalize">{item.position}</span> },
    { key: 'isActive', header: 'Status', cell: (item) => <StatusBadge status={item.isActive ? 'success' : 'draft'} label={item.isActive ? 'Active' : 'Inactive'} /> },
  ];

  return (
    <>
      {canWrite ? (
        <div className="flex justify-end mb-4">
          <button type="button" onClick={openNew} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"><Plus className="h-4 w-4" />Add Banner</button>
        </div>
      ) : null}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold">{editing ? 'Edit Banner' : 'New Banner'}</h3>
            <div className="grid gap-4">
              <input placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" />
              <ImageUrlField
                value={form.imageUrl}
                onChange={(url) => setForm(f => ({ ...f, imageUrl: url }))}
                placeholder="Banner image"
              />
              <input placeholder="Link URL" value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" />
              <select value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm">
                <option value="homepage">Homepage</option>
                <option value="category">Category</option>
                <option value="sidebar">Sidebar</option>
                <option value="popup">Popup</option>
              </select>
              <label className="flex items-center gap-3"><input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="h-4 w-4 rounded border-border" /><span className="text-sm">Active</span></label>
              <input type="datetime-local" value={form.startsAt} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" placeholder="Start Date" />
              <input type="datetime-local" value={form.endsAt} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" placeholder="End Date" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-border rounded-md text-sm">Cancel</button>
              <button onClick={save} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">Save</button>
            </div>
          </div>
        </div>
      )}

      <DataTable
        data={filtered}
        columns={columns}
        onSearch={setSearchTerm}
        rowActions={canWrite ? (item) => (
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => openEdit(item)} className="p-1.5 text-muted-foreground hover:text-primary rounded-md hover:bg-muted" aria-label="Edit"><Edit className="h-4 w-4" /></button>
            <button onClick={() => setDeletingId(item.id)} className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-muted" aria-label="Delete"><Trash className="h-4 w-4" /></button>
          </div>
        ) : undefined}
      />
      <ConfirmationDialog isOpen={!!deletingId} title="Delete Banner" description="Remove this banner?" confirmText="Delete" variant="danger" onConfirm={remove} onCancel={() => setDeletingId(null)} />
    </>
  );
}