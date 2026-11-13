'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { MediaDialog } from './MediaDialog';
import { MediaUploader } from './MediaUploader';
import { optionPath, type MediaOption } from './media-options';
import { usePermissions } from '@/lib/hooks/use-permissions';

type MediaFile = { id: string; url: string; filename: string; originalFilename?: string; mimeType: string };
type Props = { isOpen: boolean; onClose: () => void; onSelect: (url: string) => void; multiple?: boolean; categoryId?: string };

export function MediaPicker(props: Props) {
  // Mount fresh for each use, so old selections never leak into another field.
  return props.isOpen ? <Picker {...props} /> : null;
}
function Picker({ onClose, onSelect, multiple, categoryId }: Props) {
  const { can } = usePermissions();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [folders, setFolders] = useState<MediaOption[]>([]);
  const [categories, setCategories] = useState<MediaOption[]>([]);
  const [category, setCategory] = useState(categoryId || '');
  const [folder, setFolder] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newFolder, setNewFolder] = useState('');
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/admin/media/folders?all=1', { signal: abort.signal }).then(async res => {
      if (!res.ok) throw new Error('Unable to load categories and folders.');
      const data = await res.json(); setFolders(data.folders); setCategories(data.categories);
    }).catch(err => { if (!abort.signal.aborted) setError(err.message); });
    return () => abort.abort();
  }, [revision]);
  useEffect(() => {
    const abort = new AbortController(); setLoading(true); setError('');
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ imagesOnly: '1', page: String(page), search });
        if (category) params.set('categoryId', category);
        if (folder) params.set('folderId', folder);
        const res = await fetch(`/api/admin/media/list?${params}`, { signal: abort.signal });
        if (!res.ok) throw new Error('Unable to load images. Please try again.');
        const data = await res.json(); setFiles(data.files); setPages(data.totalPages);
      } catch (err) { if (!abort.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to load images.'); }
      finally { if (!abort.signal.aborted) setLoading(false); }
    }, search ? 250 : 0);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [folder, category, search, page, revision]);
  const createFolder = async () => {
    if (!newFolder.trim() || creating) return;
    setCreating(true); setError('');
    try {
      const res = await fetch('/api/admin/media/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newFolder.trim(), parentId: folder && folder !== '__root__' ? folder : null }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Unable to create folder.');
      setNewFolder(''); setFolder(data.folder.id); setPage(1); setRevision(r => r + 1);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to create folder.'); }
    finally { setCreating(false); }
  };
  return <MediaDialog title="Media Library" onClose={onClose}>
    <div className="flex flex-wrap gap-3">
      <label className="text-sm">Product category<select aria-label="Filter media category" value={category} onChange={e => { setCategory(e.target.value); setPage(1); }} className="block rounded border bg-background p-2">
        <option value="">All categories</option><option value="__none__">Uncategorized</option>{categories.map(c => <option key={c.id} value={c.id}>{optionPath(c, categories)}</option>)}
      </select></label>
      <label className="text-sm">Media folder<select aria-label="Filter media folder" value={folder} onChange={e => { setFolder(e.target.value); setPage(1); }} className="block rounded border bg-background p-2">
        <option value="">All folders</option><option value="__root__">No folder</option>{folders.map(f => <option key={f.id} value={f.id}>{optionPath(f, folders)}</option>)}
      </select></label>
      {can('media.write') && <div className="self-end"><MediaUploader imagesOnly categoryId={category} folderId={folder} onUploadComplete={() => setRevision(r => r + 1)} /></div>}
    </div>
    {can('media.write') && <div className="flex gap-2">
      <input aria-label="New media folder" value={newFolder} maxLength={100} onChange={e => setNewFolder(e.target.value)} placeholder="New folder name" className="min-w-0 rounded border bg-background p-2 text-sm" />
      <button type="button" disabled={creating || !newFolder.trim()} onClick={createFolder} className="rounded border px-3 text-sm disabled:opacity-50">Create folder</button>
    </div>}
    <input type="search" aria-label="Search images" placeholder="Search image filenames…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="w-full rounded border bg-background p-2" />
    {error && <p role="alert" className="text-destructive">{error} <button type="button" className="underline" onClick={() => setRevision(r => r + 1)}>Retry</button></p>}
    {loading ? <p role="status">Loading images…</p> : !files.length ? <p>No images found. Try another category or upload images.</p> :
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">{files.map(file => <button type="button" key={file.id} aria-label={`Select ${file.originalFilename || file.filename}`} aria-pressed={selected.includes(file.url)}
        className={`relative aspect-square overflow-hidden rounded border-2 ${selected.includes(file.url) ? 'border-primary ring-2 ring-primary' : 'border-border'}`}
        onClick={() => { if (multiple) setSelected(prev => prev.includes(file.url) ? prev.filter(url => url !== file.url) : [...prev, file.url]); else { onSelect(file.url); onClose(); } }}>
        <Image src={file.url} alt="" fill sizes="150px" className="object-cover" />
        <span className="absolute inset-x-0 bottom-0 truncate bg-black/70 p-1 text-xs text-white">{file.originalFilename || file.filename}</span>
      </button>)}</div>}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page} of {pages}</span><button type="button" disabled={page >= pages || loading} onClick={() => setPage(p => p + 1)}>Next</button></div>
      {multiple && <button type="button" disabled={!selected.length} className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" onClick={() => { selected.forEach(onSelect); onClose(); }}>Insert selected ({selected.length})</button>}
    </div>
  </MediaDialog>;
}
