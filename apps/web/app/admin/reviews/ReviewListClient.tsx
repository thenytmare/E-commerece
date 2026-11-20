'use client';

import React, { useState } from 'react';
import { DataTable, type ColumnDef } from '@/components/admin/ui/DataTable';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import { ConfirmationDialog } from '@/components/admin/ui/ConfirmationDialog';
import { useToast } from '@/components/ui/toast';
import { Check, X, Pin, Trash, Reply } from 'lucide-react';
import { approveReviewAction, rejectReviewAction, pinReviewAction, deleteReviewAction, replyToReviewAction } from '@/lib/actions/admin-reviews';
import { usePermissions } from '@/lib/hooks/use-permissions';

type ReviewRow = {
  id: string;
  productName: string;
  productSlug: string;
  customerName: string;
  rating: number;
  title: string | null;
  body: string | null;
  isApproved: boolean;
  isPinned: boolean;
  adminReply: string | null;
  createdAt: string;
};

type FilterMode = 'all' | 'pending' | 'approved';

export function ReviewListClient({ initialData }: { initialData: ReviewRow[] }) {
  const { toast } = useToast();
  const { can } = usePermissions();
  const canWrite = can('reviews.write');
  const canDelete = can('reviews.delete');
  const [data, setData] = useState(initialData);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');

  // Each of these used to apply its optimistic update regardless of outcome,
  // so a rejected moderation looked like it had worked.
  const handleApprove = async (id: string) => {
    const res = await approveReviewAction(id);
    if (!res.success) return toast(res.error ?? 'Could not approve that review.', 'error');
    setData(c => c.map(r => (r.id === id ? { ...r, isApproved: true } : r)));
    toast('Review approved — it is now live on the product page', 'success');
  };

  const handleReject = async (id: string) => {
    const res = await rejectReviewAction(id);
    if (!res.success) return toast(res.error ?? 'Could not reject that review.', 'error');
    setData(c => c.map(r => (r.id === id ? { ...r, isApproved: false } : r)));
    toast('Review unpublished', 'success');
  };

  const handlePin = async (id: string, pin: boolean) => {
    const res = await pinReviewAction(id, pin);
    if (!res.success) return toast(res.error ?? 'Could not update that review.', 'error');
    setData(c => c.map(r => (r.id === id ? { ...r, isPinned: pin } : r)));
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deleteReviewAction(deletingId);
    if (!res.success) {
      toast(res.error ?? 'Could not delete that review.', 'error');
    } else {
      setData(c => c.filter(r => r.id !== deletingId));
      toast('Review deleted', 'success');
    }
    setDeletingId(null);
  };

  const handleReply = async () => {
    if (!replyingId || !replyText.trim()) return;
    const res = await replyToReviewAction(replyingId, replyText);
    if (!res.success) return toast(res.error ?? 'Could not save that reply.', 'error');
    setData(c => c.map(r => (r.id === replyingId ? { ...r, adminReply: replyText.trim() } : r)));
    setReplyingId(null);
    setReplyText('');
    toast('Reply saved', 'success');
  };

  const filtered = data.filter(r => {
    if (filter === 'pending') return !r.isApproved;
    if (filter === 'approved') return r.isApproved;
    return true;
  }).filter(r => r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || (r.title ?? '').toLowerCase().includes(searchTerm.toLowerCase()));

  const columns: ColumnDef<ReviewRow>[] = [
    { key: 'customerName', header: 'Customer', sortable: true, cell: (item) => <div><p className="font-medium">{item.customerName}</p><p className="text-xs text-muted-foreground">{item.productName}</p></div> },
    { key: 'rating', header: 'Rating', cell: (item) => <span className="text-yellow-500">{'⭐'.repeat(item.rating)}{item.rating}</span> },
    { key: 'title', header: 'Review', cell: (item) => <div><p className="text-sm font-medium">{item.title || 'No title'}</p>{item.body ? <p className="text-xs text-muted-foreground line-clamp-2">{item.body}</p> : null}{item.adminReply ? <p className="text-xs text-primary mt-1">↳ Reply: {item.adminReply}</p> : null}</div> },
    { key: 'isApproved', header: 'Status', cell: (item) => <StatusBadge status={item.isApproved ? 'success' : 'pending'} label={item.isApproved ? 'Approved' : 'Pending'} /> },
  ];

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        {(['all', 'pending', 'approved'] as const).map(mode => (
          <button key={mode} type="button" className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${filter === mode ? 'bg-primary text-primary-foreground' : 'bg-background border border-border text-muted-foreground hover:bg-muted'}`} onClick={() => setFilter(mode)}>{mode}</button>
        ))}
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        onSearch={setSearchTerm}
        rowActions={canWrite || canDelete ? (item) => (
          <div className="flex items-center justify-end gap-1">
            {canWrite && !item.isApproved && <button onClick={() => handleApprove(item.id)} className="p-1.5 text-muted-foreground hover:text-success rounded-md hover:bg-muted" aria-label="Approve"><Check className="h-4 w-4" /></button>}
            {canWrite && item.isApproved && <button onClick={() => handleReject(item.id)} className="p-1.5 text-muted-foreground hover:text-warning rounded-md hover:bg-muted" aria-label="Reject"><X className="h-4 w-4" /></button>}
            {canWrite && <button onClick={() => handlePin(item.id, !item.isPinned)} className={`p-1.5 rounded-md hover:bg-muted ${item.isPinned ? 'text-primary' : 'text-muted-foreground'}`} aria-label="Pin"><Pin className="h-4 w-4" /></button>}
            {canWrite && <button onClick={() => { setReplyingId(item.id); setReplyText(''); }} className="p-1.5 text-muted-foreground hover:text-primary rounded-md hover:bg-muted" aria-label="Reply"><Reply className="h-4 w-4" /></button>}
            {canDelete && <button onClick={() => setDeletingId(item.id)} className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-muted" aria-label="Delete"><Trash className="h-4 w-4" /></button>}
          </div>
        ) : undefined}
      />
      <ConfirmationDialog isOpen={!!deletingId} title="Delete Review" description="Permanently delete this review?" confirmText="Delete" variant="danger" onConfirm={handleDelete} onCancel={() => setDeletingId(null)} />
      {replyingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold">Reply to Review</h3>
            <textarea className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" rows={4} value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write your reply..." />
            <div className="flex justify-end gap-2">
              <button onClick={() => setReplyingId(null)} className="px-4 py-2 border border-border rounded-md text-sm">Cancel</button>
              <button onClick={handleReply} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">Send Reply</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}