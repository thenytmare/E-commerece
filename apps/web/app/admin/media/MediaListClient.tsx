'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { DataTable, type ColumnDef } from '@/components/admin/ui/DataTable';
import { ConfirmationDialog } from '@/components/admin/ui/ConfirmationDialog';
import { Trash, ImageIcon } from 'lucide-react';
import {
  deleteMediaAction,
  bulkDeleteMediaAction,
  moveMediaToFolderAction,
  assignMediaCategoryAction,
} from '@/lib/actions/admin-media';
import { MediaUploader } from '@/components/admin/media/MediaUploader';
import { formatDate } from '@/lib/format';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { optionPath, type MediaOption } from '@/components/admin/media/media-options';

type MediaRow = {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  alt: string;
  createdAt: string;
  categoryId: string | null;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MediaListClient({
  initialData,
  initialSearch = '',
  folders = [],
  categories, categoryId, folderId, page, totalPages,
}: {
  initialData: MediaRow[];
  initialSearch?: string;
  folders?: MediaOption[];
  categories: MediaOption[];
  categoryId: string;
  folderId: string;
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = usePermissions();
  const canWrite = can('media.write');
  const canDelete = can('media.delete');
  const [data, setData] = useState(initialData);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [creating, setCreating] = useState(false);
  const navigate = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    if (key !== 'page') params.delete('page');
    setSelectedIds([]); router.replace(`/admin/media?${params}`);
  };

  // Server-rendered results replace local state whenever the query changes.
  useEffect(() => {
    setData(initialData);
    setSelectedIds([]);
  }, [initialData]);

  // Push the search term into the URL (debounced) so filtering runs in SQL
  // across the whole library, not just the loaded page.
  useEffect(() => {
    if (searchTerm === initialSearch) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('page');
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      else params.delete('search');
      router.replace(`/admin/media${params.toString() ? `?${params}` : ''}`);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, initialSearch, router, searchParams]);

  const handleDelete = async () => {
    if (!deletingId) return;
    const result = await deleteMediaAction(deletingId);
    if (!result.success) { setError(result.error || 'Delete failed.'); setDeletingId(null); return; }
    setError('');
    setData(c => c.filter(r => r.id !== deletingId));
    setDeletingId(null);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const result = await bulkDeleteMediaAction(selectedIds);
    setBulkConfirm(false);
    if (!result.success) { setError(result.error || 'Delete failed.'); return; }
    setError('');
    setData(c => c.filter(r => !selectedIds.includes(r.id)));
    setSelectedIds([]);
  };

  // Filtering is done server-side (see the effect above).
  const filtered = data;

  const columns: ColumnDef<MediaRow>[] = [
    { key: 'categoryId', header: 'Product category', cell: item => categories.find(c => c.id === item.categoryId)?.name || 'Uncategorized' },
    {
      key: 'url',
      header: 'Preview',
      cell: (item) => (
        <div className="h-10 w-10 rounded bg-muted overflow-hidden flex-shrink-0 relative">
          {item.mimeType.startsWith('image/') ? (
            <Image src={item.url} alt={item.alt || item.filename} fill sizes="40px" className="object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">FILE</div>
          )}
        </div>
      ),
    },
    { key: 'filename', header: 'File Name', sortable: true, cell: (item) => <div><p className="font-medium text-sm truncate max-w-[200px]">{item.filename}</p><p className="text-xs text-muted-foreground">{item.mimeType}</p></div> },
    { key: 'size', header: 'Size', cell: (item) => <span className="text-sm text-muted-foreground">{formatSize(item.size)}</span> },
    { key: 'createdAt', header: 'Uploaded', cell: (item) => <span className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</span> },
  ];

  const exportCSV = () => {
    const rows = filtered.map(f => ({ Name: f.filename, Type: f.mimeType, Size: formatSize(f.size), URL: f.url, Uploaded: formatDate(f.createdAt) }));
    const header = Object.keys(rows[0] || {}).join(',');
    const body = rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'media-library.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleMoveToFolder = async (folderId: string | null) => {
    if (selectedIds.length === 0) return;
    const res = await moveMediaToFolderAction(selectedIds, folderId);
    if (res.success) {
      setError('');
      setSelectedIds([]);
      router.refresh();
    } else setError(res.error || 'Could not move files.');
  };

  const bulkActions = (
    <div className="flex items-center gap-2">
      {canWrite && <select aria-label="Assign selected files to category" defaultValue="" className="rounded border bg-background p-2 text-xs" onChange={async e => {
        const value = e.target.value; e.target.value = ''; if (!value) return;
        const result = await assignMediaCategoryAction(selectedIds, value === '__none__' ? null : value);
        if (!result.success) setError(result.error || 'Could not assign category.');
        else { setError(''); setSelectedIds([]); router.refresh(); }
      }}><option value="">Assign category…</option><option value="__none__">Uncategorized</option>{categories.map(c => <option key={c.id} value={c.id}>{optionPath(c, categories)}</option>)}</select>}
      {canWrite && folders.length > 0 && (
        <select
          defaultValue=""
          onChange={(e) => {
            const value = e.target.value;
            if (value === '') return;
            handleMoveToFolder(value === '__root__' ? null : value);
            e.target.value = '';
          }}
          className="px-2 py-1.5 border border-border bg-background rounded-md text-xs"
          aria-label="Move selected files to folder"
        >
          <option value="">Move to…</option>
          <option value="__root__">Root (no folder)</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>{optionPath(f, folders)}</option>
          ))}
        </select>
      )}
      {canDelete ? (
        <button type="button" className="px-3 py-1.5 border border-destructive/50 bg-destructive/10 rounded-md text-xs font-medium text-destructive hover:bg-destructive/20" onClick={() => setBulkConfirm(true)}>Delete Selected</button>
      ) : null}
    </div>
  );

  const handleUploadComplete = () => {
    // Refresh the page to show new uploads
    router.refresh();
  };

  return (
    <>
      {error && <p role="alert" className="mb-4 text-destructive">{error}</p>}
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="text-sm">Product category<select aria-label="Filter library category" value={categoryId} onChange={e => navigate('categoryId', e.target.value)} className="block rounded border bg-background p-2">
          <option value="">All categories</option><option value="__none__">Uncategorized</option>{categories.map(c => <option key={c.id} value={c.id}>{optionPath(c, categories)}</option>)}
        </select></label>
        <label className="text-sm">Media folder<select aria-label="Filter library folder" value={folderId} onChange={e => navigate('folderId', e.target.value)} className="block rounded border bg-background p-2">
          <option value="">All folders</option><option value="__root__">No folder</option>{folders.map(f => <option key={f.id} value={f.id}>{optionPath(f, folders)}</option>)}
        </select></label>
        {canWrite && <div className="flex self-end gap-2">
          <input aria-label="New library folder" placeholder="New folder name" maxLength={100} value={folderName} onChange={e => setFolderName(e.target.value)} className="min-w-0 rounded border bg-background p-2 text-sm" />
          <button type="button" disabled={creating || !folderName.trim()} className="rounded border px-3 text-sm disabled:opacity-50" onClick={async () => {
            setCreating(true); setError('');
            try {
              const res = await fetch('/api/admin/media/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: folderName.trim(), parentId: folderId && folderId !== '__root__' ? folderId : null }) });
              const result = await res.json(); if (!res.ok) throw new Error(result.error);
              setFolderName(''); navigate('folderId', result.folder.id); router.refresh();
            } catch { setError('Could not create folder.'); } finally { setCreating(false); }
          }}>Create folder</button>
        </div>}
      </div>
      {canWrite ? (
        <div className="flex justify-end mb-4">
          <MediaUploader categoryId={categoryId} folderId={folderId} onUploadComplete={handleUploadComplete} />
        </div>
      ) : null}
      <DataTable
        data={filtered}
        columns={columns}
        onSearch={setSearchTerm}
        searchValue={searchTerm}
        page={page}
        totalPages={totalPages}
        onPageChange={value => navigate('page', String(value))}
        emptyIcon={ImageIcon}
        emptyTitle={searchTerm ? 'No matching files' : 'No media yet'}
        emptyMessage={
          searchTerm
            ? `Nothing matches “${searchTerm}”. Try a different search.`
            : 'Upload images and documents to use them across your products and marketing.'
        }
        selectable={canWrite || canDelete}
        getRowLabel={(item) => item.filename}
        selectedIds={selectedIds}
        onSelect={setSelectedIds}
        bulkActions={bulkActions}
        onExport={exportCSV}
        exportFilename="media-library.csv"
        rowActions={(item) => (
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => window.open(item.url, '_blank')} className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-muted text-xs">View</button>
            {canDelete ? (
              <button onClick={() => setDeletingId(item.id)} className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-muted" aria-label="Delete"><Trash className="h-4 w-4" /></button>
            ) : null}
          </div>
        )}
      />
      <ConfirmationDialog isOpen={!!deletingId} title="Delete File" description="Permanently delete this file from the media library?" confirmText="Delete" variant="danger" onConfirm={handleDelete} onCancel={() => setDeletingId(null)} />
      <ConfirmationDialog isOpen={bulkConfirm} title="Delete selected files" description="Permanently delete these files? Files still used by products or other content will be kept." confirmText="Delete" variant="danger" onConfirm={handleBulkDelete} onCancel={() => setBulkConfirm(false)} />
    </>
  );
}
