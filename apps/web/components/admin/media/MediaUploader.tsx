'use client';
import { useEffect, useRef, useState } from 'react';
import { MediaDialog } from './MediaDialog';
import { optionPath, type MediaOption } from './media-options';

type Upload = { id: string; file: File; status: 'queued' | 'uploading' | 'done' | 'error'; error?: string };
type Props = { folderId?: string | null; categoryId?: string | null; imagesOnly?: boolean; onUploadComplete: () => void };

export function MediaUploader({ folderId, categoryId, imagesOnly, onUploadComplete }: Props) {
  const [open, setOpen] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [category, setCategory] = useState('');
  const [folder, setFolder] = useState('');
  const [categories, setCategories] = useState<MediaOption[]>([]);
  const [folders, setFolders] = useState<MediaOption[]>([]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const directoryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    setReady(false);
    fetch('/api/admin/media/folders?all=1', { signal: abort.signal }).then(async res => {
      if (!res.ok) throw new Error('Unable to load categories and folders. Close and try again.');
      const data = await res.json(); setCategories(data.categories); setFolders(data.folders); setReady(true);
    }).catch(err => { if (!abort.signal.aborted) setError(err.message); });
    directoryRef.current?.setAttribute('webkitdirectory', '');
    return () => abort.abort();
  }, [open]);

  const run = async (batch: Upload[]) => {
    if (busyRef.current || !ready) return;
    busyRef.current = true; setBusy(true); setError('');
    let succeeded = false;
    for (const item of batch) {
      setUploads(prev => prev.map(u => u.id === item.id ? { ...u, status: 'uploading', error: undefined } : u));
      const body = new FormData(); body.append('file', item.file);
      if (category) body.append('categoryId', category);
      if (folder) body.append('folderId', folder);
      try {
        const res = await fetch('/api/admin/media/upload', { method: 'POST', body });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed. Try again.');
        succeeded = true;
        setUploads(prev => prev.map(u => u.id === item.id ? { ...u, status: 'done' } : u));
      } catch (err) {
        setUploads(prev => prev.map(u => u.id === item.id ? { ...u, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' } : u));
      }
    }
    busyRef.current = false; setBusy(false);
    if (succeeded) onUploadComplete();
  };
  const add = (files: FileList | null) => {
    if (!files?.length || busyRef.current || !ready) return;
    const selected = Array.from(files).filter(file => !imagesOnly || file.type.startsWith('image/'));
    const batch: Upload[] = selected.map(file => ({ id: crypto.randomUUID(), file, status: 'queued' }));
    if (!batch.length) { setError('Choose image files.'); return; }
    setUploads(prev => [...prev, ...batch]); void run(batch);
  };
  return <>
    <button type="button" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" onClick={() => {
      setCategory(categoryId && categoryId !== '__none__' ? categoryId : '');
      setFolder(folderId && folderId !== '__root__' ? folderId : '');
      setUploads([]); setError(''); setOpen(true);
    }}>Upload files</button>
    {open && <MediaDialog title="Upload files" onClose={() => { if (!busyRef.current) setOpen(false); }}>
      <p className="text-sm text-muted-foreground">Choose a product category, then select several files or an entire folder. Maximum 10 MB per file.</p>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Product category
          <select aria-label="Upload product category" value={category} disabled={busy || !ready} onChange={e => setCategory(e.target.value)} className="block w-full rounded border bg-background p-2">
            <option value="">Uncategorized</option>{categories.map(c => <option key={c.id} value={c.id}>{optionPath(c, categories)}</option>)}
          </select>
        </label>
        <label className="text-sm">Media folder
          <select aria-label="Upload media folder" value={folder} disabled={busy || !ready} onChange={e => setFolder(e.target.value)} className="block w-full rounded border bg-background p-2">
            <option value="">No folder</option>{folders.map(f => <option key={f.id} value={f.id}>{optionPath(f, folders)}</option>)}
          </select>
        </label>
      </div>
      <div className="rounded border-2 border-dashed p-6 text-center space-y-3" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); add(e.dataTransfer.files); }}>
        <p>Drop files here or browse your computer.</p>
        <div className="flex justify-center gap-3">
          <button type="button" disabled={busy || !ready} onClick={() => fileRef.current?.click()} className="rounded border px-3 py-2 disabled:opacity-50">Choose files</button>
          <button type="button" disabled={busy || !ready} onClick={() => directoryRef.current?.click()} className="rounded border px-3 py-2 disabled:opacity-50">Choose folder</button>
        </div>
      </div>
      <input ref={fileRef} aria-label="Files to upload" type="file" multiple hidden accept={imagesOnly ? 'image/*' : 'image/*,.pdf,.txt,.csv'} onChange={e => { add(e.target.files); e.target.value = ''; }} />
      <input ref={directoryRef} aria-label="Folder to upload" type="file" multiple hidden onChange={e => { add(e.target.files); e.target.value = ''; }} />
      <ul aria-live="polite" className="max-h-64 overflow-auto space-y-2">{uploads.map(u => <li key={u.id} className="text-sm">
        <span className="font-medium">{u.file.webkitRelativePath || u.file.name}</span> — {u.status === 'done' ? 'Uploaded' : u.status}
        {u.error && <p className="text-destructive">{u.error}</p>}
      </li>)}</ul>
      {uploads.some(u => u.status === 'error') && <button type="button" disabled={busy} onClick={() => void run(uploads.filter(u => u.status === 'error'))} className="rounded border px-3 py-2">Retry failed uploads</button>}
      {busy && <p className="text-sm" role="status">Uploading… Keep this dialog open until uploads finish.</p>}
    </MediaDialog>}
  </>;
}
