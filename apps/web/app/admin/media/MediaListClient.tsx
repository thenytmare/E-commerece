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
} from '@/lib/actions/admin-media';
import { MediaUploader } from '@/components/admin/media/MediaUploader';
import { formatDate } from '@/lib/format';
import { usePermissions } from '@/lib/hooks/use-permissions';

type MediaRow = {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  alt: string;
  createdAt: string;
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
}: {
  initialData: MediaRow[];
  initialSearch?: string;
  folders?: { id: string; name: string }[];
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

  // Server-rendered results replace local state whenever the query changes.
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  // Push the search term into the URL (debounced) so filtering runs in SQL
  // across the whole library, not just the loaded page.
  useEffect(() => {
    if (searchTerm === initialSearch) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      else params.delete('search');
      router.replace(`/admin/media${params.toString() ? `?${params}` : ''}`);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, initialSearch, router, searchParams]);

  const handleDelete = async () => {
    if (!deletingId) return;
    await deleteMediaAction(deletingId);
    setData(c => c.filter(r => r.id !== deletingId));
    setDeletingId(null);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    await bulkDeleteMediaAction(selectedIds);
    setData(c => c.filter(r => !selectedIds.includes(r.id)));
    setSelectedIds([]);
  };

  // Filtering is done server-side (see the effect above).
  const filtered = data;

  const columns: ColumnDef<MediaRow>[] = [
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
      setSelectedIds([]);
      router.refresh();
    }
  };

  const bulkActions = (
    <div className="flex items-center gap-2">
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
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      )}
      {canDelete ? (
        <button type="button" className="px-3 py-1.5 border border-destructive/50 bg-destructive/10 rounded-md text-xs font-medium text-destructive hover:bg-destructive/20" onClick={handleBulkDelete}>Delete Selected</button>
      ) : null}
    </div>
  );

  const handleUploadComplete = () => {
    // Refresh the page to show new uploads
    window.location.reload();
  };

  return (
    <>
      {canWrite ? (
        <div className="flex justify-end mb-4">
          <MediaUploader onUploadComplete={handleUploadComplete} />
        </div>
      ) : null}
      <DataTable
        data={filtered}
        columns={columns}
        onSearch={setSearchTerm}
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
    </>
  );
}